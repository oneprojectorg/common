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

  // Shared by both mutations' onSettled: always refetch relationship data
  // after error or success. The proposal detail view refreshes via the
  // realtime channel the mutation registers (Channels.decisionProposal), so
  // it isn't invalidated here; the proposal list deliberately isn't
  // channel-invalidated, so callers pass processInstanceId to refresh their
  // own list counts.
  const queryClient = useQueryClient();

  /**
   * Move the proposal's like/follow count everywhere it is cached.
   *
   * Matched with a predicate on the tRPC path rather than a built query key:
   * the same proposal sits in several caches at once — any number of
   * `listProposals` / `listAllProposals` results (different filters or sorts,
   * plus the ballot's non-infinite query) and the `getProposal` entry — and
   * a predicate matches all of them without depending on how tRPC happens to
   * encode inputs in the key.
   *
   * Rolling back applies the opposite delta rather than restoring a snapshot.
   * Every card on the page writes to these same caches, so a snapshot taken
   * before this mutation would also undo whatever another card did in the
   * meantime.
   */
  const patchCachedCounts = (relationshipType: string, delta: number) => {
    if (!targetProfileId) {
      return;
    }

    const field: ProposalCountField =
      relationshipType === ProfileRelationshipType.LIKES
        ? 'likesCount'
        : 'followersCount';

    queryClient.setQueriesData(
      {
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
      },
      (old: unknown) => bumpProposalCount(old, targetProfileId, field, delta),
    );
  };

  /**
   * Add or drop this proposal in the viewer's relationship list.
   *
   * Same reasoning as the counts: one cache entry (`{ types: [...] }`) is
   * shared by every card on the page, so rollback removes exactly what this
   * mutation added rather than reinstating a stale copy of the whole list.
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
        // Stop an in-flight relationship fetch from landing on top of the
        // optimistic write below.
        await utils.profile.getRelationships.cancel(relationshipQueryKey);

        patchCachedRelationship(variables.relationshipType, true);
        // The pressed state comes from the cache above; the number beside it
        // lives on the list rows, so move it here too or it lags the refetch.
        patchCachedCounts(variables.relationshipType, 1);
      },
      onSuccess: () => {
        // Call user-provided onSuccess callback
        if (onSuccess) {
          onSuccess();
        }
      },
      onError: (error, variables) => {
        patchCachedRelationship(variables.relationshipType, false);
        patchCachedCounts(variables.relationshipType, -1);
        logger.error('Failed to add relationship', {
          error,
          context: 'useRelationshipMutations.add',
        });

        // Four whole sentences rather than a verb slotted into one template:
        // the pieces don't reassemble into a sentence in every language.
        toast.error(
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? t("Couldn't like this proposal. Please try again.")
            : t("Couldn't follow this proposal. Please try again."),
        );
      },
      onSettled: invalidateAfterMutation,
    });

  // Remove relationship mutation with optimistic updates
  const removeRelationshipMutation =
    trpc.decision.removeProposalRelationship.useMutation({
      onMutate: async (variables) => {
        await utils.profile.getRelationships.cancel(relationshipQueryKey);

        patchCachedRelationship(variables.relationshipType, false);
        patchCachedCounts(variables.relationshipType, -1);
      },
      onSuccess: () => {
        // Call user-provided onSuccess callback
        if (onSuccess) {
          onSuccess();
        }
      },
      onError: (error, variables) => {
        patchCachedRelationship(variables.relationshipType, true);
        patchCachedCounts(variables.relationshipType, 1);
        logger.error('Failed to remove relationship', {
          error,
          context: 'useRelationshipMutations.remove',
        });

        toast.error(
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? t("Couldn't remove your like. Please try again.")
            : t("Couldn't unfollow this proposal. Please try again."),
        );
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
