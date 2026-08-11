import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

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

  // Shared by both mutations' onSettled: always refetch relationship data
  // after error or success. The proposal detail view refreshes via the
  // realtime channel the mutation registers (Channels.decisionProposal), so
  // it isn't invalidated here; the proposal list deliberately isn't
  // channel-invalidated, so callers pass processInstanceId to refresh their
  // own list counts.
  const queryClient = useQueryClient();

  /**
   * Move the proposal's like/follow count everywhere it is cached, and hand
   * back a snapshot to roll back with.
   *
   * Matched with a predicate on the tRPC path rather than a built query key:
   * the same proposal sits in several caches at once — any number of
   * `listProposals` / `listAllProposals` results (different filters or sorts,
   * plus the ballot's non-infinite query) and the `getProposal` entry — and
   * a predicate matches all of them without depending on how tRPC happens to
   * encode inputs in the key.
   */
  const patchCachedCounts = (relationshipType: string, delta: number) => {
    if (!targetProfileId) {
      return [];
    }

    const field: ProposalCountField =
      relationshipType === ProfileRelationshipType.LIKES
        ? 'likesCount'
        : 'followersCount';

    const filter = {
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

    const snapshot = queryClient.getQueriesData(filter);

    queryClient.setQueriesData(filter, (old: unknown) =>
      bumpProposalCount(old, targetProfileId, field, delta),
    );

    return snapshot;
  };

  const restoreCachedCounts = (
    snapshot: ReturnType<typeof patchCachedCounts> | undefined,
  ) => {
    snapshot?.forEach(([key, data]) =>
      queryClient.setQueryData<unknown>(key, data),
    );
  };

  const invalidateAfterMutation = async () => {
    await Promise.all([
      utils.profile.getRelationships.invalidate(relationshipQueryKey),
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

  // Add relationship mutation with optimistic updates
  const addRelationshipMutation =
    trpc.decision.addProposalRelationship.useMutation({
      onMutate: async (variables) => {
        // Cancel outgoing refetches for the relationship queries
        await utils.profile.getRelationships.cancel(relationshipQueryKey);

        // Snapshot the previous value
        const previousData =
          utils.profile.getRelationships.getData(relationshipQueryKey);

        // Optimistically update the cache. Not gated on `previousData`: a press
        // before the relationship query resolves must still flip the button,
        // and an empty base is the right starting point either way.
        if (variables.targetProfileId) {
          const targetProfileId = variables.targetProfileId;

          utils.profile.getRelationships.setData(
            relationshipQueryKey,
            (old) => {
              const base = old ?? {};

              return {
                ...base,
                [variables.relationshipType]: [
                  ...(base[variables.relationshipType] ?? []),
                  {
                    relationshipType: variables.relationshipType,
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
                ],
              };
            },
          );
        }

        // The pressed state comes from the cache above; the number beside it
        // lives on the list rows, so move it here too or it lags the refetch.
        const previousLists = patchCachedCounts(variables.relationshipType, 1);

        return { previousData, previousLists };
      },
      onSuccess: () => {
        // Call user-provided onSuccess callback
        if (onSuccess) {
          onSuccess();
        }
      },
      onError: (error, variables, context) => {
        // Rollback. `setData(key, undefined)` is a no-op in React Query, so an
        // empty set stands in when nothing was cached — the press wrote state
        // that has to come back off, and onSettled refetches the truth anyway.
        utils.profile.getRelationships.setData(
          relationshipQueryKey,
          context?.previousData ?? {},
        );
        restoreCachedCounts(context?.previousLists);
        logger.error('Failed to add relationship', {
          error,
          context: 'useRelationshipMutations.add',
        });

        // Show user-facing error notification
        const action =
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? 'like'
            : 'follow';
        toast.error(`Failed to ${action}. Please try again.`);
      },
      onSettled: invalidateAfterMutation,
    });

  // Remove relationship mutation with optimistic updates
  const removeRelationshipMutation =
    trpc.decision.removeProposalRelationship.useMutation({
      onMutate: async (variables) => {
        // Cancel outgoing refetches for the relationship queries
        await utils.profile.getRelationships.cancel(relationshipQueryKey);

        // Snapshot the previous value
        const previousData =
          utils.profile.getRelationships.getData(relationshipQueryKey);

        // See the add mutation: ungated, so the button flips even if the
        // relationship query hasn't landed yet.
        if (variables.targetProfileId) {
          utils.profile.getRelationships.setData(
            relationshipQueryKey,
            (old) => {
              const base = old ?? {};

              return {
                ...base,
                [variables.relationshipType]: (
                  base[variables.relationshipType] ?? []
                ).filter(
                  (rel) => rel.targetProfile?.id !== variables.targetProfileId,
                ),
              };
            },
          );
        }

        const previousLists = patchCachedCounts(variables.relationshipType, -1);

        return { previousData, previousLists };
      },
      onSuccess: () => {
        // Call user-provided onSuccess callback
        if (onSuccess) {
          onSuccess();
        }
      },
      onError: (error, variables, context) => {
        // Rollback. `setData(key, undefined)` is a no-op in React Query, so an
        // empty set stands in when nothing was cached — the press wrote state
        // that has to come back off, and onSettled refetches the truth anyway.
        utils.profile.getRelationships.setData(
          relationshipQueryKey,
          context?.previousData ?? {},
        );
        restoreCachedCounts(context?.previousLists);
        logger.error('Failed to remove relationship', {
          error,
          context: 'useRelationshipMutations.remove',
        });

        // Show user-facing error notification
        const action =
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? 'unlike'
            : 'unfollow';
        toast.error(`Failed to ${action}. Please try again.`);
      },
      onSettled: invalidateAfterMutation,
    });

  // Combined loading state (includes initial query loading)
  const isLoading =
    addRelationshipMutation.isPending ||
    removeRelationshipMutation.isPending ||
    isLoadingRelationships;

  /**
   * Serialises the network writes. Two fast clicks send an add and a remove;
   * fired concurrently they can reach the server in either order, and the one
   * that lands last wins — which may be the one you clicked first.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const hasRelationship = (
    data: UserRelationships | undefined,
    relationshipType: ProfileRelationshipType,
  ) =>
    Boolean(
      data?.[relationshipType]?.some(
        (rel) => rel.targetProfile?.id === targetProfileId,
      ),
    );

  const toggleRelationship = useCallback(
    async (relationshipType: ProfileRelationshipType, context: string) => {
      if (!targetProfileId) {
        logger.error('No targetProfileId provided for relationship action', {
          context,
        });

        return;
      }

      const run = async () => {
        // Read the cache rather than the render-time `isLiked`: by the time a
        // queued click runs, the one before it has already written its own
        // optimistic state, and this click has to see it.
        //
        // `ensureData` covers the press that lands before the query does —
        // guessing there is what silently inflates the count, since the server
        // no-ops on an add that already exists but the client still counted it.
        const data =
          utils.profile.getRelationships.getData(relationshipQueryKey) ??
          (await utils.profile.getRelationships.ensureData(
            relationshipQueryKey,
          ));

        const mutation = hasRelationship(data, relationshipType)
          ? removeRelationshipMutation
          : addRelationshipMutation;

        await mutation.mutateAsync({ targetProfileId, relationshipType });
      };

      // `.then(run, run)` so a failed click doesn't strand the queue.
      const next = queue.current.then(run, run);

      queue.current = next.catch(() => undefined);

      try {
        await next;
      } catch (error) {
        // Mutation errors are rolled back and toasted in onError; mutateAsync
        // also rejects when onSuccess/onSettled throw (onError doesn't run for
        // those), so log here instead of swallowing silently.
        logger.error('Relationship mutation post-processing failed', {
          error,
          context,
        });
      }
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
