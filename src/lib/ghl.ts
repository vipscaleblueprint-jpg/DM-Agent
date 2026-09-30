// GoHighLevel (LeadConnector) API helpers. GHL is connected to the client's Facebook/Instagram page,
// so replies are sent through GHL and GHL delivers them to Meta.

const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-04-15';

export type MetaChannel = 'IG' | 'FB';

// Maps whatever GHL gives us ("Instagram", "TYPE_INSTAGRAM", "IG", "Facebook", "TYPE_FACEBOOK", ...) to a send type
export function toMetaChannel(value: unknown): MetaChannel | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'ig' || v.includes('instagram')) return 'IG';
  if (v === 'fb' || v.includes('facebook') || v.includes('messenger')) return 'FB';
  return null;
}

async function ghlFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GHL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`GHL ${res.status}: ${body?.message || res.statusText}`);
  }
  return body;
}

// Fallback when the webhook doesn't say which channel the DM came from
export async function lookupContactChannel(token: string, locationId: string, contactId: string): Promise<MetaChannel | null> {
  const qs = new URLSearchParams({ locationId, contactId });
  const data = await ghlFetch(token, `/conversations/search?${qs}`);
  for (const convo of data?.conversations || []) {
    const channel = toMetaChannel(convo.lastMessageType) || toMetaChannel(convo.type);
    if (channel) return channel;
  }
  return null;
}

export async function findConversationId(token: string, locationId: string, contactId: string): Promise<string | null> {
  const qs = new URLSearchParams({ locationId, contactId });
  const data = await ghlFetch(token, `/conversations/search?${qs}`);
  return data?.conversations?.[0]?.id || null;
}

export type GhlMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  body?: string;
  dateAdded: string;
  messageType?: string;
  attachments?: string[];
};

// One page of messages, most recent first as GHL returns them. Pass the previous page's
// lastMessageId to get the page of older messages before it.
export async function fetchConversationMessages(token: string, conversationId: string, opts: { limit?: number; lastMessageId?: string } = {}) {
  const qs = new URLSearchParams({ limit: String(opts.limit || 50) });
  if (opts.lastMessageId) qs.set('lastMessageId', opts.lastMessageId);
  const data = await ghlFetch(token, `/conversations/${conversationId}/messages?${qs}`);
  // The list is nested one level deeper than you'd expect: { messages: { messages: [...], nextPage, lastMessageId } }
  const page = Array.isArray(data?.messages) ? { messages: data.messages } : data?.messages || {};
  const messages: GhlMessage[] = Array.isArray(page.messages) ? page.messages : [];
  return {
    messages,
    nextPage: !!page.nextPage,
    lastMessageId: (page.lastMessageId || messages[messages.length - 1]?.id) as string | undefined,
  };
}

export async function sendGhlMessage(token: string, contactId: string, channel: MetaChannel, message: string) {
  const data = await ghlFetch(token, '/conversations/messages', {
    method: 'POST',
    body: JSON.stringify({ type: channel, contactId, message }),
  });
  return { messageId: data?.messageId as string | undefined, conversationId: data?.conversationId as string | undefined };
}
