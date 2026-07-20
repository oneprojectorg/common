import { invalidate, invalidateMultiple } from '@op/cache';
import { db } from '@op/db/client';

/**
 * Cache-key suffixes for everything we cache under `type: 'decision'` keyed by
 * INSTANCE id. Centralized so writers don't drift from readers: if a getter
 * adds a new suffix, add it here and every mutation that already calls
 * `invalidateDecisionInstance` will drop it. The slug-keyed overview snapshot
 * (`getDecisionBySlug`, `[slug, 'slugProfile']`) is handled separately below
 * because its key is the profile slug, not the instance id.
 */
const DECISION_CACHE_KEYS = ['instance', 'categories', 'submitters'] as const;

/**
 * Invalidate every cached projection of a decision instance — the instance
 * snapshot (`getInstance`), the categories list (`getProcessCategories`), the
 * participation face-pile (`listProposalSubmitters`), and the slug-keyed
 * overview snapshot (`getDecisionBySlug`). Call from any mutation that touches
 * `processInstances`, `decisionProcesses`, the linked profile, or any of this
 * instance's proposals.
 */
export const invalidateDecisionInstance = async (instanceId: string) => {
  // Resolve the slug here so every existing caller gets the slug-keyed
  // invalidation without a signature change. If the instance is already gone
  // (post-delete), the slug can't be resolved and the snapshot's 5-minute TTL
  // bounds the stale window — the per-request access check keeps a deleted
  // decision unreadable regardless.
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    with: { profile: { columns: { slug: true } } },
  });
  const slug = instance?.profile?.slug;

  await Promise.all([
    invalidateMultiple({
      type: 'decision',
      paramsList: DECISION_CACHE_KEYS.map((suffix) => [instanceId, suffix]),
    }),
    slug
      ? invalidate({ type: 'decision', params: [slug, 'slugProfile'] })
      : Promise.resolve(),
  ]);
};
