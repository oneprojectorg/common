import { cache } from '@op/cache';
import { createHash } from 'node:crypto';

import type { TipTapClient, TipTapFragmentResponse } from './client';

/**
 * Long Redis TTL — published (docId, versionId) tuples are immutable, so a
 * long-lived entry can never serve stale content. The cap exists only so
 * Redis memory decays naturally when a proposal stops being viewed.
 */
const COLLAB_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Build a stable, short hash of the fragment-name list so the cache key stays
 * bounded regardless of how many fragments a template defines. Sorting first
 * means callers don't have to.
 */
function hashFragmentNames(fragmentNames: string[]): string {
  const sorted = [...fragmentNames].sort();
  return createHash('sha256')
    .update(sorted.join('\n'))
    .digest('hex')
    .slice(0, 16);
}

export interface GetCachedDocumentFragmentsArgs {
  client: TipTapClient;
  docId: string;
  /**
   * The published version to fetch. When `undefined` the cache is bypassed
   * (the DRAFT path returns the live, still-mutating document).
   */
  versionId: number | undefined;
  fragmentNames: string[];
}

/**
 * Cached read-through wrapper around `client.getDocumentFragments` for the
 * `format='json'` path. Keyed by `(docId, versionId, fragmentNamesHash)` —
 * published version tuples are immutable, so different viewers can safely
 * share the response.
 *
 * DRAFT viewers pass `versionId: undefined` and short-circuit straight to
 * TipTap; nothing is written to or read from the cache for that path.
 */
export async function getCachedDocumentFragments({
  client,
  docId,
  versionId,
  fragmentNames,
}: GetCachedDocumentFragmentsArgs): Promise<TipTapFragmentResponse> {
  if (versionId === undefined) {
    return client.getDocumentFragments(docId, fragmentNames);
  }

  const fragmentsHash = hashFragmentNames(fragmentNames);

  return cache({
    type: 'collabDoc',
    params: [docId, versionId, fragmentsHash],
    fetch: () =>
      client.getDocumentFragments(docId, fragmentNames, { version: versionId }),
    options: { ttl: COLLAB_CACHE_TTL_MS },
  });
}
