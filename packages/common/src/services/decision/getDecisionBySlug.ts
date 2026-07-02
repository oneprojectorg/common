import { cache } from '@op/cache';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';

const decisionProfileQueryConfig = {
  with: {
    headerImage: true,
    avatarImage: true,
    processInstance: {
      with: {
        process: true,
        owner: { with: { avatarImage: true, organization: true } },
        steward: { with: { avatarImage: true } },
      },
    },
  },
} as const;

type LoadedDecisionProfile = NonNullable<
  Awaited<
    ReturnType<
      typeof db.query.profiles.findFirst<typeof decisionProfileQueryConfig>
    >
  >
>;

type DecisionProfileItem = Omit<LoadedDecisionProfile, 'processInstance'> & {
  processInstance: NonNullable<LoadedDecisionProfile['processInstance']>;
};

// Short TTL on purpose (mirrors the resources list cache): @op/cache
// invalidation is best-effort, so a lost invalidation — or a writer that
// bypasses invalidateDecisionInstance — must self-heal in minutes. Unknown
// slugs are never negatively cached (cache() skips null results), so a miss
// can't pin a 404.
const DECISION_SLUG_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Viewer-independent decision-profile snapshot for the overview's slug fetch,
 * cached under `['decision', slug, 'slugProfile']` (cf. getInstance's
 * `[instanceId, 'instance']`). Busted by invalidateDecisionInstance, which
 * resolves the instance's slug. skipMemCache for the same reason as the
 * resources list: mutation-driven client refetches must not read another
 * instance's stale local LRU — Redis is the shared layer the invalidate
 * clears.
 */
const getDecisionProfileSnapshot = (slug: string) =>
  cache({
    type: 'decision',
    params: [slug, 'slugProfile'],
    fetch: () =>
      db.query.profiles.findFirst({
        where: { slug, type: EntityType.DECISION },
        ...decisionProfileQueryConfig,
      }),
    options: {
      skipMemCache: true,
      ttl: DECISION_SLUG_CACHE_TTL_MS,
    },
  });

export const getDecisionBySlug = async ({
  user,
  slug,
}: {
  user: User | undefined;
  slug: string;
}): Promise<DecisionProfileItem> => {
  // The DB load is viewer-independent, so it's cached; the access check below
  // runs on every call, outside the cache, so a hit can never bypass
  // authorization (same split as getInstance).
  const profile = await getDecisionProfileSnapshot(slug);

  if (!profile?.processInstance) {
    // No readable decision with this slug. Don't distinguish "missing" from
    // "no access" — surfacing a 404 would leak which decisions exist.
    throw new UnauthorizedError('User does not have access to this process');
  }

  const instance = profile.processInstance;

  // Proposal/participant aggregates are intentionally NOT computed here: the
  // overview route (this endpoint's only consumer) never renders them, and
  // list views get their counts from listDecisionProfiles. Keeping the
  // hot-path slug fetch aggregate-free saves a proposals table scan per view.
  await assertProfileAccess({
    user,
    profileId: profile.id,
    permissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    notMemberMessage: 'User does not have access to this process',
  });

  return {
    ...profile,
    processInstance: instance,
  };
};
