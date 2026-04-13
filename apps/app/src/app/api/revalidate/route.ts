import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

/**
 * On-demand cache revalidation endpoint.
 *
 * Called by the API server (or other services) after mutations to invalidate
 * Next.js cache entries tagged with `cacheTag()` inside `use cache` functions.
 *
 * Channels used for Supabase Realtime (e.g. "org:abc", "decisionInstance:123")
 * are reused as Next.js cache tags so a single mutation invalidates both the
 * client-side React Query cache (via WebSocket) and the server-side Next.js
 * data cache (via this endpoint).
 */
export async function POST(request: NextRequest) {
  if (!REVALIDATION_SECRET) {
    return NextResponse.json(
      { error: 'Revalidation not configured' },
      { status: 500 },
    );
  }

  const secret = request.headers.get('x-revalidation-secret');

  if (secret !== REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json();

  if (
    !body ||
    typeof body !== 'object' ||
    !('tags' in body) ||
    !Array.isArray(body.tags)
  ) {
    return NextResponse.json(
      { error: 'Request body must contain a "tags" array' },
      { status: 400 },
    );
  }

  const tags: string[] = body.tags.filter(
    (t: unknown): t is string => typeof t === 'string' && t.length > 0,
  );

  for (const tag of tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ revalidated: true, tags });
}
