// Follow-up schedule, evaluated in the lead's timezone.
//
// A "follow-up round" starts when the lead last replied (or at the first message if they never did).
// Every consecutive message of ours after that point counts as one send; sends less than
// BURST_GAP_MS apart are one send (a multi-bubble message). Once the lead replies, everything resets.

export type FollowUpMessage = { role: string; createdAt: string };

type Step = { unit: 'day' | 'month'; amount: number; hour: number };

// Index 0 = 2nd follow-up ... relative to the previous send. The 1st follow-up has its own rule.
const LATER_STEPS: Step[] = [
  { unit: 'day', amount: 1, hour: 14 },    // 2nd
  { unit: 'day', amount: 3, hour: 20 },    // 3rd
  { unit: 'day', amount: 5, hour: 14 },    // 4th
  { unit: 'day', amount: 14, hour: 20 },   // 5th (2 weeks)
  { unit: 'month', amount: 1, hour: 14 },  // 6th
  { unit: 'month', amount: 3, hour: 20 },  // 7th
  { unit: 'month', amount: 6, hour: 14 },  // 8th
  { unit: 'month', amount: 12, hour: 20 }, // 9th (1 year)
];

export const MAX_FOLLOW_UPS = LATER_STEPS.length + 1;
const BURST_GAP_MS = 60 * 60 * 1000;

// A lead is flagged this long before the scheduled send time (e.g. flagged at 1pm for a 2pm follow-up)
const FLAG_LEAD_MS = 60 * 60 * 1000;

export type FollowUpStatus = {
  followUpNumber: number; // which follow-up is next (1-9)
  dueAt: number;          // epoch ms when the lead becomes "needs follow-up"
  sendAt: number;         // epoch ms of the scheduled follow-up time (2pm / 8pm)
  lastSentAt: number;     // epoch ms of our last message
};

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function isValidTimezone(tz?: string | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Timezone used for leads that have none set (server side; the UI uses the browser's timezone)
export function defaultFollowUpTimezone() {
  const envTz = process.env.FOLLOWUP_DEFAULT_TIMEZONE;
  return isValidTimezone(envTz) ? envTz : 'Asia/Manila';
}

export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function zonedParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return { year: get('year'), month: get('month') - 1, day: get('day'), hour: get('hour') };
}

// Epoch ms for a wall-clock time (year, month0, day, hour:00) in the given timezone
function zonedTimeToMs(year: number, month: number, day: number, hour: number, tz: string) {
  const wall = Date.UTC(year, month, day, hour);
  let ms = wall;
  // Two passes so the offset is taken at the target instant (handles DST edges)
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(ms, tz);
    ms += wall - Date.UTC(p.year, p.month, p.day, p.hour);
  }
  return ms;
}

function addMonthsClamped(year: number, month: number, day: number, months: number) {
  const target = month + months;
  const y = year + Math.floor(target / 12);
  const m = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { year: y, month: m, day: Math.min(day, lastDay) };
}

function firstFollowUpSendTime(sentAt: number, tz: string) {
  const p = zonedParts(sentAt, tz);
  // 8am-12pm -> 2pm same day, 12pm-6pm -> 8pm same day, after 6pm -> 2pm next day.
  // Before 8am isn't specified; treated like the morning slot (2pm same day).
  if (p.hour < 12) return zonedTimeToMs(p.year, p.month, p.day, 14, tz);
  if (p.hour < 18) return zonedTimeToMs(p.year, p.month, p.day, 20, tz);
  return zonedTimeToMs(p.year, p.month, p.day + 1, 14, tz);
}

function laterFollowUpSendTime(sentAt: number, step: Step, tz: string) {
  const p = zonedParts(sentAt, tz);
  if (step.unit === 'day') return zonedTimeToMs(p.year, p.month, p.day + step.amount, step.hour, tz);
  const d = addMonthsClamped(p.year, p.month, p.day, step.amount);
  return zonedTimeToMs(d.year, d.month, d.day, step.hour, tz);
}

// Every "needs follow-up" flag lands at 1pm or 7pm local time (1h before the 2pm / 8pm send),
// so the next moment anything can become due in a timezone is the next 1pm or 7pm there.
export function nextFlagTime(tz: string, afterMs: number) {
  const p = zonedParts(afterMs, tz);
  let best = Infinity;
  for (let d = 0; d <= 1; d++) {
    for (const hour of [14, 20].map(h => h - FLAG_LEAD_MS / 3_600_000)) {
      const ms = zonedTimeToMs(p.year, p.month, p.day + d, hour, tz);
      if (ms > afterMs && ms < best) best = ms;
    }
  }
  return best;
}

// `messages` may be in any order. Returns null when no follow-up is pending
// (lead replied last, no messages yet, or all follow-ups have been used).
export function getFollowUpStatus(messages: FollowUpMessage[] | undefined, tz: string): FollowUpStatus | null {
  if (!messages?.length) return null;
  const sorted = [...messages]
    .map(m => ({ role: m.role, at: new Date(m.createdAt).getTime() }))
    .sort((a, b) => a.at - b.at);

  if (sorted[sorted.length - 1].role !== 'assistant') return null;

  // Trailing run of our messages since the lead's last reply
  let start = sorted.length - 1;
  while (start > 0 && sorted[start - 1].role === 'assistant') start--;
  const run = sorted.slice(start);

  // Group into sends
  let sends = 1;
  for (let i = 1; i < run.length; i++) {
    if (run[i].at - run[i - 1].at >= BURST_GAP_MS) sends++;
  }
  if (sends > MAX_FOLLOW_UPS) return null;

  const lastSentAt = run[run.length - 1].at;
  const sendAt = sends === 1
    ? firstFollowUpSendTime(lastSentAt, tz)
    : laterFollowUpSendTime(lastSentAt, LATER_STEPS[sends - 2], tz);

  return { followUpNumber: sends, dueAt: sendAt - FLAG_LEAD_MS, sendAt, lastSentAt };
}
