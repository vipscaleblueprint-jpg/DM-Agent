import { prisma } from '@/lib/prisma';

// A lead marked Done by hand is locked so the AI can't move it. When that lead writes again (e.g. a
// past buyer asking about another product), release the lock so the AI can re-judge the status.
// The AI only keeps DONE if the new messages aren't about anything new (see the DONE rule in actions.ts).
export async function releaseDoneLock(leadId: string) {
  await prisma.leadState.updateMany({
    where: { lead_id: leadId, leadStatus: 'DONE', leadStatusManual: true },
    data: { leadStatusManual: false },
  });
}
