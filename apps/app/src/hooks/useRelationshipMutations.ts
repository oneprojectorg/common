import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import { toast } from '@op/ui/Toast';
import { useCallback } from 'react';

interface UseRelationshipMutationsOptions {
  targetProfileId?: string | null;
  onSuccess?: () => void;
  invalidateQueries?: Array<{
    profileId?: string | null;
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
  onSuccess,
  invalidateQueries = [],
}: UseRelationshipMutationsOptions) {
  const utils = trpc.useUtils();

  // Query key for relationship data
  const relationshipQueryKey = {
    types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
  };

  // Get user's likes and follows
  const { data: userRelationships, isLoading: isLoadingRelationships } =
    trpc.profile.getRelationships.useQuery(relationshipQueryKey);

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

  // Add relationship mutation with optimistic updates
  const addRelationshipMutation = trpc.profile.addRelationship.useMutation({
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

      return { previousData };
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
      console.error('Failed to add relationship:', error);

      // Show user-facing error notification
      const action =
        variables.relationshipType === ProfileRelationshipType.LIKES
          ? 'like'
          : 'follow';
      toast.error({
        message: `Failed to ${action}. Please try again.`,
      });
    },
    onSettled: async () => {
      // Relationship queries are automatically invalidated via subscription channels.
      // Only manually invalidate proposal queries if needed.
      if (invalidateQueries.length > 0) {
        await Promise.all(
          invalidateQueries.flatMap((query) => {
            const promises = [];
            if (query.profileId) {
              promises.push(
                utils.decision.getProposal.invalidate({
                  profileId: query.profileId,
                }),
              );
            }
            if (query.processInstanceId) {
              promises.push(
                utils.decision.listProposals.invalidate({
                  processInstanceId: query.processInstanceId,
                }),
              );
            }
            return promises;
          }),
        );
      }
    },
  });

  // Remove relationship mutation with optimistic updates
  const removeRelationshipMutation =
    trpc.profile.removeRelationship.useMutation({
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

        return { previousData };
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
        console.error('Failed to remove relationship:', error);

        // Show user-facing error notification
        const action =
          variables.relationshipType === ProfileRelationshipType.LIKES
            ? 'unlike'
            : 'unfollow';
        toast.error({
          message: `Failed to ${action}. Please try again.`,
        });
      },
      onSettled: async () => {
        // Relationship queries are automatically invalidated via subscription channels.
        // Only manually invalidate proposal queries if needed.
        if (invalidateQueries.length > 0) {
          await Promise.all(
            invalidateQueries.flatMap((query) => {
              const promises = [];
              if (query.profileId) {
                promises.push(
                  utils.decision.getProposal.invalidate({
                    profileId: query.profileId,
                  }),
                );
              }
              if (query.processInstanceId) {
                promises.push(
                  utils.decision.listProposals.invalidate({
                    processInstanceId: query.processInstanceId,
                  }),
                );
              }
              return promises;
            }),
          );
        }
      },
    });

  // Combined loading state (includes initial query loading)
  const isLoading =
    addRelationshipMutation.isPending ||
    removeRelationshipMutation.isPending ||
    isLoadingRelationships;

  // Handler for like/unlike
  const handleLike = useCallback(async () => {
    if (!targetProfileId) {
      console.error('No targetProfileId provided for like action');
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
          pending: false,
        });
      }
    } catch (error) {
      // Error handling and user notification is done in mutation's onError
      // Just catch to prevent unhandled promise rejection
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
      console.error('No targetProfileId provided for follow action');
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
          pending: false,
        });
      }
    } catch (error) {
      // Error handling and user notification is done in mutation's onError
      // Just catch to prevent unhandled promise rejection
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
