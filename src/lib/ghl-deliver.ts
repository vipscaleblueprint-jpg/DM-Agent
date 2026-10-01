import { prisma } from '@/lib/prisma';
import { toMetaChannel, lookupContactChannel, sendGhlMessage, type MetaChannel } from '@/lib/ghl';

// Meta only lets a page message someone within 24h of their last message to it
export const META_WINDOW_MS = 24 * 60 * 60 * 1000;

// Sends an already-saved assistant message through GHL. When it can't be sent (auto-reply off,
// held, outside Meta's window, unknown channel, API error) the message is kept as a draft in the app
// so someone can send it by hand. Returns whether it was sent.
export async function deliverDraft({ leadId, messageId, text, holdReason, channelHint = null }: {
  leadId: string; messageId: bigint; text: string; holdReason?: string | null; channelHint?: MetaChannel | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const markAsDraft = async (reason: string) => {
    await prisma.conversation.update({ where: { id: messageId }, data: { autoDraft: true } });
    return { sent: false, reason };
  };

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { Client: true } });
  const { ghlToken, ghlAutoReply, ghlLocationId } = lead.Client;
  if (!ghlAutoReply || !ghlToken || !lead.ghlContactId || !ghlLocationId) return markAsDraft('auto-reply is off');

  // Anything that looks like the lead steered the AI waits for a human (see src/lib/reply-guard.ts)
  if (holdReason) {
    console.warn(`[ghl-deliver] reply held as a draft for ${leadId}: ${holdReason}`);
    return markAsDraft(holdReason);
  }

  const lastInbound = await prisma.conversation.findFirst({
    where: { lead_id: leadId, role: 'user' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!lastInbound || Date.now() - lastInbound.createdAt.getTime() > META_WINDOW_MS) {
    return markAsDraft("outside Meta's 24h messaging window");
  }

  try {
    let channel = channelHint || toMetaChannel(lead.ghlChannel);
    if (!channel) {
      channel = await lookupContactChannel(ghlToken, ghlLocationId, lead.ghlContactId);
      if (channel) await prisma.lead.update({ where: { id: leadId }, data: { ghlChannel: channel, updatedAt: new Date() } });
    }
    if (!channel) {
      console.error('[ghl-deliver] could not tell if contact is on Instagram or Facebook', leadId);
      return markAsDraft('unknown channel');
    }
    const sent = await sendGhlMessage(ghlToken, lead.ghlContactId, channel, text);
    if (sent.messageId) {
      await prisma.conversation.update({ where: { id: messageId }, data: { ghlMessageId: sent.messageId } });
    }
    return { sent: true };
  } catch (err: any) {
    console.error('[ghl-deliver] send failed', leadId, err);
    return markAsDraft(err?.message || 'send failed');
  }
}
