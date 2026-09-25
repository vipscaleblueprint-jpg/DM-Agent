// Runs once when the Next.js server starts. Starts the in-process follow-up scheduler,
// but only when ENABLE_FOLLOWUP_CRON=true (it needs a long-running Node server, not serverless).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.ENABLE_FOLLOWUP_CRON !== 'true') return;

  const { runAutoDraftFollowUps } = await import('./lib/auto-draft');
  const { nextFlagTime, isValidTimezone, defaultFollowUpTimezone } = await import('./lib/followup');
  const { prisma } = await import('./lib/prisma');

  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  // Leads only become "needs follow-up" at 1pm or 7pm in their own timezone, so instead of polling
  // we sleep until the next 1pm/7pm in any timezone that a lead uses (plus the default one).
  const planNext = async () => {
    try {
      const rows = await prisma.lead.findMany({
        where: { timezone: { not: null } },
        distinct: ['timezone'],
        select: { timezone: true },
      });
      const zones = new Set<string>([defaultFollowUpTimezone()]);
      for (const r of rows) if (isValidTimezone(r.timezone)) zones.add(r.timezone);

      const now = Date.now();
      let next = Infinity;
      for (const tz of zones) next = Math.min(next, nextFlagTime(tz, now));

      clearTimeout(timer);
      timer = setTimeout(tick, Math.max(next + 60_000 - now, 1_000)); // 1 minute after the flag time
      console.log(`[followup-cron] next check ${new Date(next + 60_000).toISOString()} (${zones.size} timezone(s))`);
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
