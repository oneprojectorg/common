import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useQueryClient } from '@tanstack/react-query';

import { useTranslations } from '@/lib/i18n';

import {
  type ProposalCountField,
  bumpProposalCount,
} from './optimisticProposalCounts';
import { requestRelationship } from './relationshipDrain';

interface UseRelationshipMutationsOptions {
  targetProfileId?: string | null;
  /**
   * Skip the relationship lookup entirely. For surfaces that render the
   * like/follow state but can't act on it — a reviewer-only role, say — so they
   * don't subscribe to a list they'll never use.
   */
  enabled?: boolean;
  invalidateQueries?: Array<{
    processInstanceId?: string;
  }>;
}

// Type definitions based on the tRPC output schema
type RelationshipProfile = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatarImage: {
    id: string;
    name: string | null;
  } | null;
  type: string;
};

type RelationshipItem = {
  relationshipType: string;
  pending: boolean | null;
  createdAt: string | null;
  targetProfile?: RelationshipProfile;
  sourceProfile?: RelationshipProfile;
};

type UserRelationships = Partial<
  Record<ProfileRelationshipType, RelationshipItem[]>
>;

/**
 * Like/follow a proposal's profile, with optimistic cache updates and one
 * request per burst of clicks rather than one per click.
 *
 * @param targetProfileId - The profile ID to create relationships with
 * @param enabled - Whether to subscribe to the viewer's relationship list
 * @param invalidateQueries - Extra proposal lists to refresh once the writes settle
 */
export function useRelationshipMutations({
  targetProfileId,
  enabled = true,
  invalidateQueries = [],
}: UseRelationshipMutationsOptions) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const { user } = useUser();

  // Query key for relationship data
  const relationshipQueryKey = {
    types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
  };

  // Get user's likes and follows
  const { data: userRelationships, error: relationshipsError } =
    trpc.profile.getRelationships.useQuery(relationshipQueryKey, {
      enabled: !!user && enabled,
    });

  // Check if current user has liked/followed this profile
  const isLiked = Boolean(
    (userRelationships as UserRelationships | undefined)?.likes?.some(
      (r) => r.targetProfile?.id === targetProfileId,
    ),
  );

  const isFollowed = Boolean(
    (userRelationships as UserRelationships | undefined)?.following?.some(
      (r) => r.targetProfile?.id === targetProfileId,
    ),
  );

  // The raw client rather than `utils`: the count caches are matched by a
  // predicate on the tRPC path, which the typed helpers can't express.
  const queryClient = useQueryClient();

  /** Move the proposal's like/follow count everywhere it is cached. */
  const patchCachedCounts = (
    relationshipType: ProfileRelationshipType,
    delta: number,
  ) => {
    if (!targetProfileId) {
      return;
    }

    queryClient.setQueriesData(countQueryFilter, (old: unknown) =>
      bumpProposalCount(
        old,
        targetProfileId,
        COUNT_FIELD[relationshipType],
        delta,
      ),
    );
  };

  /**
   * Add or drop this proposal in the viewer's relationship list — the cache the
   * pressed state is read from.
   *
   * The row written is a stub with an empty name and slug, safe only because
   * this key has exactly one reader and it touches `targetProfile.id` alone.
   */
  const patchCachedRelationship = (
    relationshipType: ProfileRelationshipType,
    present: boolean,
  ) => {
    if (!targetProfileId) {
      return;
    }

    utils.profile.getRelationships.setData(relationshipQueryKey, (old) => {
      const base = old ?? {};
      const without = (base[relationshipType] ?? []).filter(
        (rel) => rel.targetProfile?.id !== targetProfileId,
      );

      return {
        ...base,
        [relationshipType]: present
          ? [
              ...without,
              {
                relationshipType,
                pending: false,
                createdAt: new Date().toISOString(),
                targetProfile: {
                  id: targetProfileId,
                  name: '',
                  slug: '',
                  bio: null,
                  avatarImage: null,
                  type: 'proposal',
                },
              },
            ]
          : without,
      };
    });
  };

  /**
   * Pull the truth back in once the writes stop. Invalidates everything the
   * optimistic patches touched — including `listAllProposals` and
   * `getProposal`, which the counts are written to but nothing else refetches,
   * so a count that drifted had no way back.
   */
  const reconcile = async () => {
    await Promise.all([
      utils.profile.getRelationships.invalidate(relationshipQueryKey),
      // `refetchType: 'all'`, not the default 'active': `setQueriesData` wrote
      // every matching entry, so an unmounted `getProposal` or an off-screen
      // filter would otherwise keep the optimistic delta and serve it on mount.
      queryClient.invalidateQueries({
        ...countQueryFilter,
        refetchType: 'all',
      }),
      ...invalidateQueries.flatMap((query) =>
        query.processInstanceId
          ? [
              utils.decision.listProposals.invalidate({
                processInstanceId: query.processInstanceId,
              }),
            ]
          : [],
      ),
    ]);
  };

  // The cache writes live in `toggleRelationship`, not in `onMutate`: a burst
  // of clicks has to move the UI on every press, while sending far fewer
  // requests than there were presses.
  const addRelationshipMutation =
    trpc.decision.addProposalRelationship.useMutation({
      // Failures are logged once, in the drain's catch — it has the burst
      // context, and logging here too splits the PostHog issue group.
      onError: (_error, variables) => {
        // Four whole sentences rather than a verb slotted into one template:
        // the pieces don't reassemble into a sentence in every language.
        toast.error(
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? t("Couldn't like this proposal. Please try again.")
            : t("Couldn't follow this proposal. Please try again."),
        );
      },
    });

  const removeRelationshipMutation =
    trpc.decision.removeProposalRelationship.useMutation({
      onError: (_error, variables) => {
        toast.error(
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? t("Couldn't remove your like. Please try again.")
            : t("Couldn't unfollow this proposal. Please try again."),
        );
      },
    });

  const isLikedInCache = (relationshipType: ProfileRelationshipType) =>
    Boolean(
      utils.profile.getRelationships
        .getData(relationshipQueryKey)
        ?.[relationshipType]?.some(
          (rel) => rel.targetProfile?.id === targetProfileId,
        ),
    );

  // Not wrapped in useCallback: it closes over every helper above, all of them
  // rebuilt each render, so an honest dependency array would invalidate on
  // every render anyway. Nothing downstream is memoised.
  const toggleRelationship = (
    relationshipType: ProfileRelationshipType,
    context: string,
  ) => {
    if (!targetProfileId) {
      logger.error('No targetProfileId provided for relationship action', {
        context,
      });

      return;
    }

    // Anything in flight would land on top of the writes below and undo the
    // press — including the refetches `reconcile` kicks off. Both caches, not
    // just the relationship one: a stale list result resets the count while
    // the button stays pressed, and the next click then counts the same like
    // twice.
    void utils.profile.getRelationships.cancel(relationshipQueryKey);
    void queryClient.cancelQueries(countQueryFilter);

    // Flip the cache first, every time: the press has to register even while
    // an earlier one is still in the air.
    const next = !isLikedInCache(relationshipType);

    patchCachedRelationship(relationshipType, next);
    patchCachedCounts(relationshipType, next ? 1 : -1);

    // Keyed by proposal and type rather than held per instance: the same
    // proposal can be mounted twice at once, and both toggles must feed the
    // one drain.
    void requestRelationship(`${targetProfileId}:${relationshipType}`, next, {
      send: async (target) => {
        const mutation = target
          ? addRelationshipMutation
          : removeRelationshipMutation;

        await mutation.mutateAsync({ targetProfileId, relationshipType });
      },
      reconcile,
      // Toasted in the mutation's onError; the reconcile puts the cache back to
      // whatever the server actually has.
      onError: (error) =>
        logger.error('Relationship write failed', {
          error,
          context: `useRelationshipMutations.${relationshipType}`,
        }),
    });
  };

  return {
    isLiked,
    isFollowed,
    /**
     * The relationship list failed to load, so `isLiked` / `isFollowed` are
     * both reading false for want of data rather than because they're false.
     * Callers should fall back to read-only counts instead of offering a
     * toggle that would send a redundant write.
     */
    error: relationshipsError,

    handleLike: () =>
      toggleRelationship(
        ProfileRelationshipType.LIKES,
        'useRelationshipMutations.like',
      ),
    handleFollow: () =>
      toggleRelationship(
        ProfileRelationshipType.FOLLOWING,
        'useRelationshipMutations.follow',
      ),
  };
}

/** Which proposal count each relationship type moves. */
const COUNT_FIELD: Record<ProfileRelationshipType, ProposalCountField> = {
  [ProfileRelationshipType.LIKES]: 'likesCount',
  [ProfileRelationshipType.FOLLOWING]: 'followersCount',
};

/**
 * Every cache an optimistic count is written to.
 *
 * A predicate on the tRPC path rather than a built query key: the same proposal
 * sits in several caches at once — any number of `listProposals` /
 * `listAllProposals` results (different filters or sorts, plus the ballot's
 * non-infinite query) and the `getProposal` entry. One definition, used for the
 * cancel, the write and the invalidate alike; drift between them means writing
 * to a cache nothing invalidates, which is the frozen-count bug this file
 * already fixed once.
 */
const countQueryFilter = {
  predicate: (query: { queryKey: readonly unknown[] }) => {
    const [path] = query.queryKey;

    return (
      Array.isArray(path) &&
      path[0] === 'decision' &&
      (path[1] === 'listProposals' ||
        path[1] === 'listAllProposals' ||
        path[1] === 'getProposal')
    );
  },
};
