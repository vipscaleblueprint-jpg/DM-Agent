import { prisma } from '@/lib/prisma';
import { generateDraftResponse } from '@/app/actions';
import { getFollowUpStatus, isValidTimezone, defaultFollowUpTimezone } from '@/lib/followup';

// Drafting calls the LLM once per lead, so a single run is capped. Leads left over are picked up on the next run.
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

// Drafts the next follow-up for every lead that is currently flagged as "needs follow-up"
// (see src/lib/followup.ts). Each draft is saved as an assistant message, which moves the lead on
// to its next follow-up step, so re-running never drafts the same one twice.
export async function runAutoDraftFollowUps({ limit = DEFAULT_LIMIT, dryRun = false }: { limit?: number; dryRun?: boolean } = {}) {
  const cap = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Used for leads with no timezone set
  const fallbackTz = defaultFollowUpTimezone();

  const leads = await prisma.lead.findMany({
    // Not-qualified leads are closed out, so no more follow-ups for them
    where: { LeadState: { is: { leadStatus: { not: 'NOT_QUALIFIED' } } } },
    select: {
      id: true,
      name: true,
      client_id: true,
      timezone: true,
      Conversation: {
        where: { NOT: { content: { startsWith: '[[STAGE_MARKER:' } } },
        orderBy: { createdAt: 'desc' },
        select: { role: true, createdAt: true },
      },
    },
  });

  const now = Date.now();
  const due = leads
    .map(lead => {
      const tz = isValidTimezone(lead.timezone) ? lead.timezone : fallbackTz;
      const status = getFollowUpStatus(lead.Conversation.map(m => ({ role: m.role, createdAt: m.createdAt.toISOString() })), tz);
      return { lead, status };
    })
    .filter((x): x is { lead: typeof x.lead; status: NonNullable<typeof x.status> } => !!x.status && x.status.dueAt <= now)
    .sort((a, b) => a.status.dueAt - b.status.dueAt);

  const batch = due.slice(0, cap);
  const drafted: { leadId: string; name: string; followUpNumber: number }[] = [];
  const failed: { leadId: string; name: string; error: string }[] = [];

  if (!dryRun) {
    // Sequential on purpose: keeps LLM rate limits and DB load predictable
    for (const { lead, status } of batch) {
      const res = await generateDraftResponse(lead.id, lead.client_id, undefined, { followUpNumber: status.followUpNumber });
      if (res.success) drafted.push({ leadId: lead.id, name: lead.name, followUpNumber: status.followUpNumber });
      else failed.push({ leadId: lead.id, name: lead.name, error: res.error || 'Unknown error' });
    }
  }

  return {
    checked: leads.length,
    due: due.length,
    drafted: drafted.length,
    remaining: dryRun ? due.length : due.length - batch.length,
    dryRun,
    draftedLeads: dryRun
      ? batch.map(({ lead, status }) => ({ leadId: lead.id, name: lead.name, followUpNumber: status.followUpNumber }))
      : drafted,
    failed,
  };
}
