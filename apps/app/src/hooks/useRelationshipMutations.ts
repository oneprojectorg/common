import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  type ProposalCountField,
  bumpProposalCount,
} from './optimisticProposalCounts';

interface UseRelationshipMutationsOptions {
  targetProfileId?: string | null;
  /**
   * Skip the relationship lookup entirely. For surfaces that render the
   * like/follow state but can't act on it — a reviewer-only role, say — so they
   * don't subscribe to a list they'll never use.
   */
  enabled?: boolean;
  onSuccess?: () => void;
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
 * Hook to manage profile relationship mutations (likes and follows) with optimistic updates
 *
 * @param targetProfileId - The profile ID to create relationships with
 * @param onSuccess - Optional callback to run on successful mutations
 * @param invalidateQueries - Optional array of additional queries to invalidate (e.g., proposal or list queries)
 *
 * @returns Object containing handlers, state, and mutation utilities
 */
export function useRelationshipMutations({
  targetProfileId,
  enabled = true,
  onSuccess,
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
  const { data: userRelationships, isLoading: isLoadingRelationships } =
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
      onSuccess: () => onSuccess?.(),
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
      onSuccess: () => onSuccess?.(),
      onError: (_error, variables) => {
        toast.error(
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? t("Couldn't remove your like. Please try again.")
            : t("Couldn't unfollow this proposal. Please try again."),
        );
      },
    });

  // Combined loading state (includes initial query loading)
  const isLoading =
    addRelationshipMutation.isPending ||
    removeRelationshipMutation.isPending ||
    isLoadingRelationships;

  /** What the user wants, and what we last managed to send, per type. */
  const desired = useRef<Partial<Record<ProfileRelationshipType, boolean>>>({});
  const sent = useRef<Partial<Record<ProfileRelationshipType, boolean>>>({});
  const draining = useRef<Partial<Record<ProfileRelationshipType, boolean>>>(
    {},
  );

  const isLikedInCache = (relationshipType: ProfileRelationshipType) =>
    Boolean(
      utils.profile.getRelationships
        .getData(relationshipQueryKey)
        ?.[relationshipType]?.some(
          (rel) => rel.targetProfile?.id === targetProfileId,
        ),
    );

  /**
   * Send whatever the user has settled on, one request at a time, re-reading
   * their intent after each one. Clicks that arrive mid-flight change the
   * target rather than queueing behind it, so ten taps are at most two
   * requests: the one already going, and one to correct it.
   */
  const drain = async (relationshipType: ProfileRelationshipType) => {
    if (!targetProfileId || draining.current[relationshipType]) {
      return;
    }

    draining.current[relationshipType] = true;

    // Forget this burst and pull the truth back in. Stays inside the loop so a
    // click that lands during the refetch is picked up here rather than by a
    // second drain racing the queries this one just kicked off.
    const settle = async () => {
      delete desired.current[relationshipType];
      delete sent.current[relationshipType];
      await reconcile();
    };

    try {
      while (desired.current[relationshipType] !== undefined) {
        const target = desired.current[relationshipType];

        if (target === sent.current[relationshipType]) {
          await settle();
          continue;
        }

        const mutation = target
          ? addRelationshipMutation
          : removeRelationshipMutation;

        try {
          await mutation.mutateAsync({ targetProfileId, relationshipType });
          sent.current[relationshipType] = target;
        } catch (error) {
          // Toasted in onError; the reconcile puts the cache back to whatever
          // the server actually has.
          logger.error('Relationship write failed', {
            error,
            context: `useRelationshipMutations.${relationshipType}`,
          });

          // `continue`, not `break`: settle() cleared the burst, so with no
          // further press the loop condition ends it here anyway. A click that
          // landed during the reconcile is the one case `break` got wrong — it
          // couldn't start its own drain (lease still held) and was dropped
          // silently, leaving the cache flipped against the server.
          await settle();
          continue;
        }
      }
    } finally {
      draining.current[relationshipType] = false;
    }
  };

  const toggleRelationship = useCallback(
    (relationshipType: ProfileRelationshipType, context: string) => {
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

      desired.current[relationshipType] = next;
      patchCachedRelationship(relationshipType, next);
      patchCachedCounts(relationshipType, next ? 1 : -1);

      void drain(relationshipType);
    },
    [
      targetProfileId,
      utils,
      addRelationshipMutation,
      removeRelationshipMutation,
    ],
  );

  const handleLike = useCallback(
    () =>
      toggleRelationship(
        ProfileRelationshipType.LIKES,
        'useRelationshipMutations.like',
      ),
    [toggleRelationship],
  );

  const handleFollow = useCallback(
    () =>
      toggleRelationship(
        ProfileRelationshipType.FOLLOWING,
        'useRelationshipMutations.follow',
      ),
    [toggleRelationship],
  );

  return {
    // State
    isLiked,
    isFollowed,
    isLoading,

    // Handlers
    handleLike,
    handleFollow,

    // Raw mutations (for advanced use cases)
    addRelationshipMutation,
    removeRelationshipMutation,
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
