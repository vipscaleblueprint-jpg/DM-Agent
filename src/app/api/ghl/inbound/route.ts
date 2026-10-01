import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDraftResponse } from '@/app/actions';
import { toMetaChannel } from '@/lib/ghl';
import { deliverDraft } from '@/lib/ghl-deliver';
import { realMessagesOnly } from '@/lib/agent-note';
import { syncGhlConversation } from '@/lib/ghl-sync';
import { releaseDoneLock } from '@/lib/lead-status';

// Drafting + sending runs after the response, so give it room
export const maxDuration = 60;

// Leads often send several bubbles in a row. Each one triggers this webhook, so we wait a bit and
// only the webhook for the latest message replies.
const REPLY_DELAY_MS = (Number(process.env.GHL_REPLY_DELAY_SECONDS) || 15) * 1000;

// The same text from the same lead within this window is the same message: either GHL retrying the
// webhook, or the message was already pulled in by a GHL sync (e.g. someone opened the lead) before
// the webhook arrived
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

// Inbound messages (by id) that already have a reply scheduled, so a GHL retry doesn't reply twice.
// Kept for longer than the duplicate window.
const replyScheduled = new Set<string>();
function markReplyScheduled(id: bigint) {
  replyScheduled.add(id.toString());
  setTimeout(() => replyScheduled.delete(id.toString()), DUPLICATE_WINDOW_MS + 60_000);
}

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
        // GHL doesn't tell us where the lead is. Left empty (set by hand); follow-ups use the client's timezone meanwhile
        timezone: null,
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
  const last = await prisma.conversation.findFirst({ where: { lead_id: lead.id, ...realMessagesOnly }, orderBy: { createdAt: 'desc' } });
  const alreadySaved = last?.role === 'user' && last.content === content && Date.now() - last.createdAt.getTime() < DUPLICATE_WINDOW_MS;
  if (alreadySaved && replyScheduled.has(last.id.toString())) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Saved by a sync but not replied to yet: reply to that copy instead of saving a second one
  const inbound = alreadySaved
    ? last
    : await prisma.conversation.create({
        data: { lead_id: lead.id, role: 'user', content, stage: lead.LeadState?.stage || 1 },
      });
  await releaseDoneLock(lead.id);

  if (lead.LeadState?.leadStatus === 'NOT_QUALIFIED') {
    return NextResponse.json({ ok: true, leadId: lead.id, skipped: 'lead is not qualified' });
  }

  const leadId = lead.id;
  markReplyScheduled(inbound.id);
  after(async () => {
    try {
      await replyToLead({ leadId, inboundId: inbound.id, channelHint });
    } catch (err) {
      console.error('[ghl-inbound] reply failed', leadId, err);
    }
  });

  return NextResponse.json({ ok: true, leadId });
}

async function replyToLead({ leadId, inboundId, channelHint }: {
  leadId: string; inboundId: bigint; channelHint: 'IG' | 'FB' | null;
}) {
  await new Promise(r => setTimeout(r, REPLY_DELAY_MS));

  // Pull in anything sent from GHL directly (e.g. a person replying there) so the AI sees it
  try {
    await syncGhlConversation(leadId);
  } catch (err) {
    console.error('[ghl-inbound] history sync failed, replying with what we have', leadId, err);
  }

  // A newer message came in (its own webhook will reply), or someone already answered (in GHL or the app)
  const latest = await prisma.conversation.findFirst({ where: { lead_id: leadId, ...realMessagesOnly }, orderBy: { createdAt: 'desc' } });
  if (latest?.id !== inboundId) return;

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const draft = await generateDraftResponse(leadId, lead.client_id);
  if (!draft.success || !draft.messageId) {
    console.error('[ghl-inbound] draft failed', leadId, draft.error);
    return;
  }

  await deliverDraft({ leadId, messageId: draft.messageId, text: draft.response!, holdReason: draft.holdReason, channelHint });
}
