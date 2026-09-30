import { prisma } from '@/lib/prisma';
import { findConversationId, fetchConversationMessages, type GhlMessage } from '@/lib/ghl';

// A message we saved ourselves (webhook inbound, or our own reply) is matched to its GHL copy by
// role + text when it was saved within this long of GHL's timestamp
const MATCH_WINDOW_MS = 10 * 60 * 1000;

// Safety cap on how far back one sync pages (50 messages per page)
const MAX_PAGES = 40;

function toContent(m: GhlMessage) {
  const text = (m.body || '').trim();
  if (text) return text;
  return m.attachments?.length ? '[Sent an attachment]' : '';
}

// Pulls the lead's GHL conversation and saves any message DM Agent doesn't have yet, e.g. replies
// someone typed directly in GHL. Outbound messages (by a person or by us) are saved as 'assistant'.
export async function syncGhlConversation(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { Client: true, LeadState: true },
  });
  const { ghlToken, ghlLocationId } = lead.Client;
  if (!ghlToken || !ghlLocationId || !lead.ghlContactId) return { added: 0 };

  let conversationId = lead.ghlConversationId;
  if (!conversationId) {
    conversationId = await findConversationId(ghlToken, ghlLocationId, lead.ghlContactId);
    if (!conversationId) return { added: 0 };
    await prisma.lead.update({ where: { id: leadId }, data: { ghlConversationId: conversationId, updatedAt: new Date() } });
  }

  // Page back from the newest message until we reach one we already have. The first sync of a
  // lead therefore imports the whole history; later syncs usually need just one page.
  const fetched: GhlMessage[] = [];
  const known = new Set<string>();
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await fetchConversationMessages(ghlToken, conversationId, { lastMessageId: cursor });
    fetched.push(...page.messages);
    const ids = page.messages.map(m => m.id);
    const alreadySaved = await prisma.conversation.findMany({ where: { ghlMessageId: { in: ids } }, select: { ghlMessageId: true } });
    alreadySaved.forEach(r => known.add(r.ghlMessageId!));
    if (alreadySaved.length > 0 || !page.nextPage || !page.lastMessageId || page.lastMessageId === cursor) break;
    cursor = page.lastMessageId;
  }

  const messages = fetched
    .filter(m => (m.direction === 'inbound' || m.direction === 'outbound') && !m.messageType?.startsWith('TYPE_ACTIVITY'))
    .reverse(); // oldest first

  let added = 0;
  for (const m of messages) {
    if (known.has(m.id)) continue;
    const content = toContent(m);
    if (!content) continue;

    const role = m.direction === 'inbound' ? 'user' : 'assistant';
    const sentAt = new Date(m.dateAdded);

    // Already saved by us without the GHL id: link it (and use GHL's time so ordering is exact)
    const mine = await prisma.conversation.findFirst({
      where: {
        lead_id: leadId,
        role,
        content,
        ghlMessageId: null,
        createdAt: { gte: new Date(sentAt.getTime() - MATCH_WINDOW_MS), lte: new Date(sentAt.getTime() + MATCH_WINDOW_MS) },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (mine) {
      await prisma.conversation.update({ where: { id: mine.id }, data: { ghlMessageId: m.id, createdAt: sentAt } });
      continue;
    }

    await prisma.conversation.create({
      data: { lead_id: leadId, role, content, createdAt: sentAt, stage: lead.LeadState?.stage || 1, ghlMessageId: m.id },
    });
    added++;
  }

  return { added };
}
