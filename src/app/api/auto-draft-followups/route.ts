import { NextResponse } from 'next/server';
import { runAutoDraftFollowUps, DEFAULT_LIMIT } from '@/lib/auto-draft';

// Manual / external trigger (e.g. n8n). The built-in scheduler in src/instrumentation.ts runs the same logic.
export async function POST(request: Request) {
  const secret = process.env.FOLLOWUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'FOLLOWUP_SECRET is not set on the server' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const requested = parseInt(url.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LIMIT;
  const dryRun = url.searchParams.get('dryRun') === 'true';

  try {
    return NextResponse.json(await runAutoDraftFollowUps({ limit, dryRun }));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
