'use client';

import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { ProfileRelationshipType } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Heart } from 'lucide-react';
import { LuBookmark } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

type Proposal = z.infer<typeof proposalEncoder>;

export function ProposalCardActions({
  proposal: initialProposal,
}: {
  proposal: Proposal;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  // Subscribe to the individual proposal data which gets optimistically updated
  const { data: currentProposal } = trpc.decision.getProposal.useQuery(
    { profileId: initialProposal.profileId },
    {
      refetchOnMount: false,
      initialData: initialProposal,
    },
  );

  // Get user's likes and follows in a single request to avoid caching issues
  const { data: userRelationships } = trpc.profile.getRelationships.useQuery({
    types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
  });

  // Check if current user has liked/followed this proposal
  const isLikedByUser = Boolean(
    userRelationships?.likes?.some((r: any) => r.targetProfile?.id === currentProposal.profileId)
  );

  const isFollowedByUser = Boolean(
    userRelationships?.following?.some((r: any) => r.targetProfile?.id === currentProposal.profileId)
  );

  // Direct tRPC mutations with optimistic updates
  const addRelationshipMutation = trpc.profile.addRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches for the relationship queries
      await utils.profile.getRelationships.cancel({
        types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
      });

      // Snapshot the previous value
      const previousData = utils.profile.getRelationships.getData({
        types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
      });

      // Optimistically update the cache
      if (previousData && variables.targetProfileId && typeof previousData === 'object' && !Array.isArray(previousData)) {
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
        const existingRelationships = optimisticData[variables.relationshipType] || [];
        optimisticData[variables.relationshipType] = [
          ...existingRelationships,
          optimisticRelationship,
        ];

        utils.profile.getRelationships.setData(
          { types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING] },
          optimisticData,
        );
      }

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.profile.getRelationships.setData(
          { types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING] },
          context.previousData,
        );
      }
      console.error('Failed to add relationship:', error);
    },
    onSettled: (_data, _error, _variables) => {
      // Only refetch relationship data - no need to invalidate proposal caches
      // since they no longer contain user-specific data
      utils.profile.getRelationships.invalidate({
        types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
      });
      // Still need to invalidate proposal/list data to update like/follower counts
      utils.decision.getProposal.invalidate({
        profileId: currentProposal.profileId,
      });
      if (initialProposal.processInstance?.id) {
        utils.decision.listProposals.invalidate({
          processInstanceId: initialProposal.processInstance.id,
        });
      }
    },
  });

  const removeRelationshipMutation =
    trpc.profile.removeRelationship.useMutation({
      onMutate: async (variables) => {
        // Cancel outgoing refetches for the relationship queries
        await utils.profile.getRelationships.cancel({
          types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
        });

        // Snapshot the previous value
        const previousData = utils.profile.getRelationships.getData({
          types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
        });

        // Optimistically update the cache
        if (previousData && variables.targetProfileId && typeof previousData === 'object' && !Array.isArray(previousData)) {
          const optimisticData = { ...previousData };
          const existingRelationships = optimisticData[variables.relationshipType] || [];
          optimisticData[variables.relationshipType] = existingRelationships.filter(
            (rel) => rel.targetProfile?.id !== variables.targetProfileId,
          );

          utils.profile.getRelationships.setData(
            { types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING] },
            optimisticData,
          );
        }

        return { previousData };
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousData) {
          utils.profile.getRelationships.setData(
            { types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING] },
            context.previousData,
          );
        }
        console.error('Failed to remove relationship:', error);
      },
      onSettled: (_data, _error, _variables) => {
        // Only refetch relationship data - no need to invalidate proposal caches
        // since they no longer contain user-specific data
        utils.profile.getRelationships.invalidate({
          types: [ProfileRelationshipType.LIKES, ProfileRelationshipType.FOLLOWING],
        });
        // Still need to invalidate proposal/list data to update like/follower counts
        utils.decision.getProposal.invalidate({
          profileId: currentProposal.profileId,
        });
        if (initialProposal.processInstance?.id) {
          utils.decision.listProposals.invalidate({
            processInstanceId: initialProposal.processInstance.id,
          });
        }
      },
    });

  const isLoading =
    addRelationshipMutation.isPending || removeRelationshipMutation.isPending;

  const handleLikeClick = async () => {
    if (!currentProposal.profileId) {
      console.error('No profileId provided for like action');
      return;
    }

    try {
      if (isLikedByUser) {
        // Unlike
        await removeRelationshipMutation.mutateAsync({
          targetProfileId: currentProposal.profileId,
          relationshipType: ProfileRelationshipType.LIKES,
        });
      } else {
        // Like
        await addRelationshipMutation.mutateAsync({
          targetProfileId: currentProposal.profileId,
          relationshipType: ProfileRelationshipType.LIKES,
          pending: false,
        });
      }
    } catch (error) {
      console.error('Error in ProposalCardActions handleLikeClick:', error);
    }
  };

  const handleFollowClick = async () => {
    if (!currentProposal.profileId) {
      console.error('No profileId provided for follow action');
      return;
    }

    if (isFollowedByUser) {
      // Unfollow
      await removeRelationshipMutation.mutateAsync({
        targetProfileId: currentProposal.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
      });
    } else {
      // Follow
      await addRelationshipMutation.mutateAsync({
        targetProfileId: currentProposal.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });
    }
  };

  return (
    <div className="flex w-full items-center gap-4 sm:w-auto">
      <Button
        onPress={handleLikeClick}
        size="small"
        color={isLikedByUser ? 'verified' : 'secondary'}
        className="w-full text-nowrap"
        isDisabled={isLoading}
      >
        <Heart className="size-4" />
        {isLikedByUser ? t('Liked') : t('Like')}
      </Button>
      <Button
        onPress={handleFollowClick}
        size="small"
        color={isFollowedByUser ? 'verified' : 'secondary'}
        className="w-full text-nowrap"
        isDisabled={isLoading}
      >
        <LuBookmark className="size-4" />
        {isFollowedByUser ? t('Following') : t('Follow')}
      </Button>
    </div>
  );
}
