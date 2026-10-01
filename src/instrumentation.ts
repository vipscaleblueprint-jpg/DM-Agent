// Runs once when the Next.js server starts. Starts the in-process follow-up scheduler,
// but only when ENABLE_FOLLOWUP_CRON=true (it needs a long-running Node server, not serverless).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.ENABLE_FOLLOWUP_CRON !== 'true') return;

  const { runAutoDraftFollowUps } = await import('./lib/auto-draft');
  const { nextSendTime, isValidTimezone, defaultFollowUpTimezone } = await import('./lib/followup');
  const { prisma } = await import('./lib/prisma');

  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  // Follow-ups only go out at 2pm or 8pm in the lead's own timezone, so instead of polling
  // we sleep until the next 2pm/8pm in any timezone that a lead uses (plus the default one).
  const planNext = async () => {
    try {
      const rows = await prisma.lead.findMany({
        where: { timezone: { not: null } },
        distinct: ['timezone'],
        select: { timezone: true },
      });
      // Leads without a timezone follow their client's
      const clientRows = await prisma.client.findMany({
        where: { timezone: { not: null } },
        distinct: ['timezone'],
        select: { timezone: true },
      });
      const zones = new Set<string>([defaultFollowUpTimezone()]);
      for (const r of [...rows, ...clientRows]) if (isValidTimezone(r.timezone)) zones.add(r.timezone);

      const now = Date.now();
      let next = Infinity;
      for (const tz of zones) next = Math.min(next, nextSendTime(tz, now));

      clearTimeout(timer);
      timer = setTimeout(tick, Math.max(next + 5_000 - now, 1_000)); // just after the send time
      console.log(`[followup-cron] next check ${new Date(next + 5_000).toISOString()} (${zones.size} timezone(s))`);
    } catch (err) {
      console.error('[followup-cron] planning failed, retrying in 15 min', err);
      clearTimeout(timer);
      timer = setTimeout(tick, 15 * 60_000);
    }
  };

  const tick = async () => {
    if (running) return; // previous run still drafting
    running = true;
    try {
      // A run drafts a limited batch, so keep going until nothing is left due
      for (let i = 0; i < 20; i++) {
        const res = await runAutoDraftFollowUps();
        if (res.drafted || res.failed.length) {
          console.log(`[followup-cron] drafted ${res.drafted}, failed ${res.failed.length}, remaining ${res.remaining}`);
        }
        if (res.drafted === 0 || res.remaining === 0) break;
      }
    } catch (err) {
      console.error('[followup-cron] run failed', err);
    } finally {
      running = false;
      await planNext();
    }
  };

  // Lets addLead/editLead re-plan when a lead's timezone changes
  (globalThis as any).__rescheduleFollowUpCron = planNext;

  // Catch up shortly after boot in case a flag time passed while the server was down
  timer = setTimeout(tick, 30_000);
  console.log('[followup-cron] scheduler started');
}
