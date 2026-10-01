// Agent notes: private guidance from the business owner, stored in the conversation at a point in
// time. The AI reads them, but they are never sent, never shown to the lead, and don't count as
// messages for follow-ups. Stored as an assistant message with this prefix (like stage markers), so a
// lead can't create one by typing the prefix: lead messages are always saved as role "user".
export const NOTE_PREFIX = '[[AGENT_NOTE]]';
export const STAGE_MARKER_PREFIX = '[[STAGE_MARKER:';

export function isAgentNote(m: { role: string; content: string }) {
  return m.role === 'assistant' && m.content.startsWith(NOTE_PREFIX);
}

export function toNoteContent(text: string) {
  return NOTE_PREFIX + text;
}

export function noteText(content: string) {
  return content.startsWith(NOTE_PREFIX) ? content.slice(NOTE_PREFIX.length) : content;
}

// Prisma `where` filter for real messages only (no stage markers, no agent notes)
export const realMessagesOnly = {
  NOT: [
    { content: { startsWith: STAGE_MARKER_PREFIX } },
    { role: 'assistant' as const, content: { startsWith: NOTE_PREFIX } },
  ],
};
