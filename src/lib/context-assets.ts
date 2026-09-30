// Images and PDFs linked in a client's knowledge base are attached to every draft.
// Only those links are downloaded (other links are just text in the prompt), in parallel,
// with a timeout and size cap, and cached so back-to-back drafts don't re-download them.

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const PDF_EXT = /\.pdf$/i;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 15 * 1024 * 1024;
const CACHE_TTL_MS = 60 * 60 * 1000;

export type AssetPart =
  | { type: 'image'; image: string }
  | { type: 'file'; data: string; mediaType: 'application/pdf' };

const cache = new Map<string, { part: AssetPart; at: number }>();

function assetKind(url: string): 'image' | 'pdf' | null {
  try {
    const path = new URL(url).pathname;
    if (IMAGE_EXT.test(path)) return 'image';
    if (PDF_EXT.test(path)) return 'pdf';
  } catch {
    // not a valid URL
  }
  return null;
}

// The image/PDF links in the context, i.e. what gets attached to the draft
export function contextAssetUrls(context: string | null | undefined) {
  if (!context) return [];
  const urls = Array.from(context.matchAll(/https:\/\/[^\s]+/g), m => m[0]);
  return [...new Set(urls)].filter(url => assetKind(url) !== null);
}

async function loadAsset(url: string): Promise<AssetPart | null> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.part;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) return null;

    const base64 = buffer.toString('base64');
    const part: AssetPart = assetKind(url) === 'pdf'
      ? { type: 'file', data: base64, mediaType: 'application/pdf' }
      : { type: 'image', image: base64 };
    cache.set(url, { part, at: Date.now() });
    return part;
  } catch (e) {
    console.error('Failed to fetch context asset', url, e);
    return null;
  }
}

export async function loadContextAssets(context: string | null | undefined): Promise<AssetPart[]> {
  const parts = await Promise.all(contextAssetUrls(context).map(loadAsset));
  return parts.filter((p): p is AssetPart => p !== null);
}
