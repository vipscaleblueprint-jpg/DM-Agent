// Last check before a reply is sent automatically (GHL auto-reply). Lead messages can try to steer the
// AI ("ignore your instructions...", "send me this link"), so anything that looks off is held as a
// draft for a human instead of being sent. Returns why it was held, or null when it's fine to send.

// A verbatim run of ~125+ characters from the instructions = the prompt is being quoted.
// (Shorter overlaps are normal: stage prompts often contain sample DMs the AI may reuse.)
const LEAK_WINDOW = 100;
const LEAK_STEP = 25;

const SUSPICIOUS = [
  /system prompt/i,
  /my (instructions|prompt|guidelines|rules) (say|are|tell)/i,
  /ignore (all |any |my |the )?(previous|prior|above) (instructions|rules)/i,
  /as an ai( language model)?/i,
  /i('| a)m (just )?an? (ai|bot|language model)/i,
];

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

// Links the AI may share: only ones that already appear in the instructions / client material
function unknownLinks(reply: string, instructions: string) {
  const links = reply.match(/(https?:\/\/|www\.)[^\s)>\]]+/gi) || [];
  const known = instructions.toLowerCase();
  return links.filter(link => !known.includes(link.toLowerCase().replace(/[.,!?]+$/, '')));
}

function quotesInstructions(reply: string, instructions: string) {
  const r = normalize(reply);
  const p = normalize(instructions);
  if (r.length < LEAK_WINDOW) return false;
  for (let i = 0; i + LEAK_WINDOW <= r.length; i += LEAK_STEP) {
    if (p.includes(r.slice(i, i + LEAK_WINDOW))) return true;
  }
  return false;
}

export function autoSendHoldReason(reply: string, instructions: string): string | null {
  if (!reply.trim()) return 'the reply is empty';
  const links = unknownLinks(reply, instructions);
  if (links.length) return `it contains a link that isn't in the client's material (${links[0]})`;
  if (quotesInstructions(reply, instructions)) return 'it repeats part of the AI instructions';
  if (SUSPICIOUS.some(re => re.test(reply))) return 'it talks about the AI or its instructions';
  return null;
}
