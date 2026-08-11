import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { useCallback } from 'react';

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
   * Move the proposal's like/follow count in every cached `listProposals`
   * result and hand back a snapshot to roll back with.
   *
   * Matched on the router path alone rather than a specific input: the same
   * proposal can sit in several lists at once (different filters or sorts, plus
   * the ballot's non-infinite query), and the row is found by profileId
   * wherever it appears.
   */
  const patchCachedCounts = (relationshipType: string, delta: number) => {
    if (!targetProfileId) {
      return [];
    }

    const field: ProposalCountField =
      relationshipType === ProfileRelationshipType.LIKES
        ? 'likesCount'
        : 'followersCount';
    const queryKey = getQueryKey(trpc.decision.listProposals);
    const snapshot = queryClient.getQueriesData({ queryKey });

    queryClient.setQueriesData({ queryKey }, (old: unknown) =>
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

        // Optimistically update the cache
        if (
          previousData &&
          variables.targetProfileId &&
          typeof previousData === 'object' &&
          !Array.isArray(previousData)
        ) {
          // Create a minimal relationship object for optimistic update
          const optimisticRelationship = {
            relationshipType: variables.relationshipType,
            pending: false,
            createdAt: new Date().toISOString(),
            targetProfile: {
              id: variables.targetProfileId,
              name: '',
              slug: '',
              bio: null,
              avatarImage: null,
              type: 'proposal',
            },
          };

          const optimisticData = { ...previousData };
          const existingRelationships =
            optimisticData[variables.relationshipType] || [];
          optimisticData[variables.relationshipType] = [
            ...existingRelationships,
            optimisticRelationship,
          ];

          utils.profile.getRelationships.setData(
            relationshipQueryKey,
            optimisticData,
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
        // Rollback on error
        if (context?.previousData) {
          utils.profile.getRelationships.setData(
            relationshipQueryKey,
            context.previousData,
          );
        }
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

        // Optimistically update the cache
        if (
          previousData &&
          variables.targetProfileId &&
          typeof previousData === 'object' &&
          !Array.isArray(previousData)
        ) {
          const optimisticData = { ...previousData };
          const existingRelationships =
            optimisticData[variables.relationshipType] || [];
          optimisticData[variables.relationshipType] =
            existingRelationships.filter(
              (rel) => rel.targetProfile?.id !== variables.targetProfileId,
            );

          utils.profile.getRelationships.setData(
            relationshipQueryKey,
            optimisticData,
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
        // Rollback on error
        if (context?.previousData) {
          utils.profile.getRelationships.setData(
            relationshipQueryKey,
            context.previousData,
          );
        }
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

  // Handler for like/unlike
  const handleLike = useCallback(async () => {
    if (!targetProfileId) {
      logger.error('No targetProfileId provided for like action', {
        context: 'useRelationshipMutations.like',
      });
      return;
    }

    try {
      if (isLiked) {
        // Unlike
        await removeRelationshipMutation.mutateAsync({
          targetProfileId,
          relationshipType: ProfileRelationshipType.LIKES,
        });
      } else {
        // Like
        await addRelationshipMutation.mutateAsync({
          targetProfileId,
          relationshipType: ProfileRelationshipType.LIKES,
        });
      }
    } catch (error) {
      // Mutation errors are rolled back and toasted in onError; mutateAsync
      // also rejects when onSuccess/onSettled throw (onError doesn't run for
      // those), so log here instead of swallowing silently.
      logger.error('Like mutation post-processing failed', {
        error,
        context: 'useRelationshipMutations.like',
      });
    }
  }, [
    targetProfileId,
    isLiked,
    addRelationshipMutation,
    removeRelationshipMutation,
  ]);

  // Handler for follow/unfollow
  const handleFollow = useCallback(async () => {
    if (!targetProfileId) {
      logger.error('No targetProfileId provided for follow action', {
        context: 'useRelationshipMutations.follow',
      });
      return;
    }

    try {
      if (isFollowed) {
        // Unfollow
        await removeRelationshipMutation.mutateAsync({
          targetProfileId,
          relationshipType: ProfileRelationshipType.FOLLOWING,
        });
      } else {
        // Follow
        await addRelationshipMutation.mutateAsync({
          targetProfileId,
          relationshipType: ProfileRelationshipType.FOLLOWING,
        });
      }
    } catch (error) {
      // Mutation errors are rolled back and toasted in onError; mutateAsync
      // also rejects when onSuccess/onSettled throw (onError doesn't run for
      // those), so log here instead of swallowing silently.
      logger.error('Follow mutation post-processing failed', {
        error,
        context: 'useRelationshipMutations.follow',
      });
    }
  }, [
    targetProfileId,
    isFollowed,
    addRelationshipMutation,
    removeRelationshipMutation,
  ]);

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
