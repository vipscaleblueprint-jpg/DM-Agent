import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDraftResponse } from '@/app/actions';
import { toMetaChannel, lookupContactChannel, sendGhlMessage } from '@/lib/ghl';
import { syncGhlConversation } from '@/lib/ghl-sync';

// Drafting + sending runs after the response, so give it room
export const maxDuration = 60;

// Leads often send several bubbles in a row. Each one triggers this webhook, so we wait a bit and
// only the webhook for the latest message replies.
const REPLY_DELAY_MS = (Number(process.env.GHL_REPLY_DELAY_SECONDS) || 15) * 1000;

// Same text from the same lead within this window is treated as a GHL retry
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

// Called by a GHL workflow ("Customer Replied" trigger -> Webhook action) for each inbound FB/IG DM.
// The secret can be sent as a header or, since some GHL webhook actions can't set headers, as ?secret=.
export async function POST(request: Request) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'GHL_WEBHOOK_SECRET is not set on the server' }, { status: 500 });
  }
  const url = new URL(request.url);
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || request.headers.get('x-webhook-secret')
    || url.searchParams.get('secret');
  if (given !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Accept both the standard GHL workflow payload and explicitly mapped custom data
  const body = { ...raw, ...(raw.customData || {}) };
  const locationId: string | undefined = body.locationId || body.location?.id || body.location_id;
  const contactId: string | undefined = body.contactId || body.contact_id;
  const messageText: string = (typeof body.message === 'string' ? body.message : body.message?.body) || '';
  const name: string = body.name || body.full_name || [body.first_name, body.last_name].filter(Boolean).join(' ') || 'Unknown Lead';
  const channelHint = toMetaChannel(body.channel) || toMetaChannel(body.message?.type) || toMetaChannel(body.messageType);

  if (!locationId || !contactId) {
    return NextResponse.json({ error: 'locationId and contactId are required' }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { ghlLocationId: locationId } });
  if (!client) {
    return NextResponse.json({ error: `No client is linked to GHL location ${locationId}` }, { status: 404 });
  }

  let lead = await prisma.lead.findUnique({ where: { ghlContactId: contactId }, include: { LeadState: true } });
  if (lead && lead.client_id !== client.id) {
    return NextResponse.json({ error: 'Contact belongs to a different client' }, { status: 409 });
  }
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        client_id: client.id,
        timezone: client.timezone || 'Asia/Manila',
        ghlContactId: contactId,
        ghlChannel: channelHint,
        updatedAt: new Date(),
        LeadState: { create: { stage: 1, stageName: 'getting_to_know', updatedAt: new Date() } },
      },
      include: { LeadState: true },
    });
  } else if (channelHint && lead.ghlChannel !== channelHint) {
    await prisma.lead.update({ where: { id: lead.id }, data: { ghlChannel: channelHint, updatedAt: new Date() } });
  }

  const content = messageText.trim() || '[Sent an attachment]';
  const last = await prisma.conversation.findFirst({ where: { lead_id: lead.id }, orderBy: { createdAt: 'desc' } });
  if (last?.role === 'user' && last.content === content && Date.now() - last.createdAt.getTime() < DUPLICATE_WINDOW_MS) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const inbound = await prisma.conversation.create({
    data: { lead_id: lead.id, role: 'user', content, stage: lead.LeadState?.stage || 1 },
  });

  if (lead.LeadState?.leadStatus === 'NOT_QUALIFIED') {
    return NextResponse.json({ ok: true, leadId: lead.id, skipped: 'lead is not qualified' });
  }

  const leadId = lead.id;
  after(async () => {
    try {
      await replyToLead({ leadId, inboundId: inbound.id, contactId, locationId, channelHint });
    } catch (err) {
      console.error('[ghl-inbound] reply failed', leadId, err);
    }
  });

  return NextResponse.json({ ok: true, leadId });
}

async function replyToLead({ leadId, inboundId, contactId, locationId, channelHint }: {
  leadId: string; inboundId: bigint; contactId: string; locationId: string; channelHint: 'IG' | 'FB' | null;
}) {
  await new Promise(r => setTimeout(r, REPLY_DELAY_MS));

  // Pull in anything sent from GHL directly (e.g. a person replying there) so the AI sees it
  try {
    await syncGhlConversation(leadId);
  } catch (err) {
    console.error('[ghl-inbound] history sync failed, replying with what we have', leadId, err);
  }

  // A newer message came in (its own webhook will reply), or someone already answered (in GHL or the app)
  const latest = await prisma.conversation.findFirst({ where: { lead_id: leadId }, orderBy: { createdAt: 'desc' } });
  if (latest?.id !== inboundId) return;

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { Client: true } });
  const draft = await generateDraftResponse(leadId, lead.client_id);
  if (!draft.success || !draft.messageId) {
    console.error('[ghl-inbound] draft failed', leadId, draft.error);
    return;
  }

  const markAsDraft = () => prisma.conversation.update({ where: { id: draft.messageId }, data: { autoDraft: true } });

  const { ghlToken, ghlAutoReply } = lead.Client;
  if (!ghlAutoReply || !ghlToken) {
    await markAsDraft();
    return;
  }

  try {
    let channel = channelHint || toMetaChannel(lead.ghlChannel);
    if (!channel) {
      channel = await lookupContactChannel(ghlToken, locationId, contactId);
      if (channel) await prisma.lead.update({ where: { id: leadId }, data: { ghlChannel: channel, updatedAt: new Date() } });
    }
    if (!channel) {
      console.error('[ghl-inbound] could not tell if contact is on Instagram or Facebook', leadId);
      await markAsDraft();
      return;
    }
    const sent = await sendGhlMessage(ghlToken, contactId, channel, draft.response!);
    if (sent.messageId) {
      await prisma.conversation.update({ where: { id: draft.messageId }, data: { ghlMessageId: sent.messageId } });
    }
  } catch (err) {
    // Keep it visible in the app as a draft so someone can send it by hand
    console.error('[ghl-inbound] send failed', leadId, err);
    await markAsDraft();
  }
}
