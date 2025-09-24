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

  // Direct tRPC mutations with optimistic updates
  const addRelationshipMutation = trpc.profile.addRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      if (initialProposal.processInstance?.id) {
        await utils.decision.listProposals.cancel({
          processInstanceId: initialProposal.processInstance.id,
        });
      }
      await utils.decision.getProposal.cancel({
        profileId: currentProposal.profileId,
      });

      // Snapshot the previous values
      const previousListData = initialProposal.processInstance?.id
        ? utils.decision.listProposals.getData({
            processInstanceId: initialProposal.processInstance.id,
          })
        : null;
      const previousProposalData = utils.decision.getProposal.getData({
        profileId: currentProposal.profileId,
      });

      // Optimistically update list data
      if (previousListData && initialProposal.processInstance?.id) {
        const optimisticListData = {
          ...previousListData,
          proposals: previousListData.proposals.map((p) =>
            p.id === currentProposal.id
              ? {
                  ...p,
                  isLikedByUser:
                    variables.relationshipType === ProfileRelationshipType.LIKES
                      ? true
                      : p.isLikedByUser,
                  isFollowedByUser:
                    variables.relationshipType ===
                    ProfileRelationshipType.FOLLOWING
                      ? true
                      : p.isFollowedByUser,
                  likesCount:
                    variables.relationshipType === ProfileRelationshipType.LIKES
                      ? (p.likesCount || 0) + 1
                      : p.likesCount,
                  followersCount:
                    variables.relationshipType ===
                    ProfileRelationshipType.FOLLOWING
                      ? (p.followersCount || 0) + 1
                      : p.followersCount,
                }
              : p,
          ),
        };
        utils.decision.listProposals.setData(
          { processInstanceId: initialProposal.processInstance.id },
          optimisticListData,
        );
      }

      // Optimistically update individual proposal data
      if (previousProposalData) {
        const optimisticProposalData = {
          ...previousProposalData,
          isLikedByUser:
            variables.relationshipType === ProfileRelationshipType.LIKES
              ? true
              : previousProposalData.isLikedByUser,
          isFollowedByUser:
            variables.relationshipType === ProfileRelationshipType.FOLLOWING
              ? true
              : previousProposalData.isFollowedByUser,
          likesCount:
            variables.relationshipType === ProfileRelationshipType.LIKES
              ? (previousProposalData.likesCount || 0) + 1
              : previousProposalData.likesCount,
          followersCount:
            variables.relationshipType === ProfileRelationshipType.FOLLOWING
              ? (previousProposalData.followersCount || 0) + 1
              : previousProposalData.followersCount,
        };
        utils.decision.getProposal.setData(
          { profileId: currentProposal.profileId },
          optimisticProposalData,
        );
      }

      return { previousListData, previousProposalData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousListData && initialProposal.processInstance?.id) {
        utils.decision.listProposals.setData(
          { processInstanceId: initialProposal.processInstance.id },
          context.previousListData,
        );
      }
      if (context?.previousProposalData) {
        utils.decision.getProposal.setData(
          { profileId: currentProposal.profileId },
          context.previousProposalData,
        );
      }
      console.error('Failed to add relationship:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
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
        // Cancel outgoing refetches
        if (initialProposal.processInstance?.id) {
          await utils.decision.listProposals.cancel({
            processInstanceId: initialProposal.processInstance.id,
          });
        }
        await utils.decision.getProposal.cancel({
          profileId: currentProposal.profileId,
        });

        // Snapshot the previous values
        const previousListData = initialProposal.processInstance?.id
          ? utils.decision.listProposals.getData({
              processInstanceId: initialProposal.processInstance.id,
            })
          : null;
        const previousProposalData = utils.decision.getProposal.getData({
          profileId: currentProposal.profileId,
        });

        // Optimistically update list data
        if (previousListData && initialProposal.processInstance?.id) {
          const optimisticListData = {
            ...previousListData,
            proposals: previousListData.proposals.map((p) =>
              p.id === currentProposal.id
                ? {
                    ...p,
                    isLikedByUser:
                      variables.relationshipType ===
                      ProfileRelationshipType.LIKES
                        ? false
                        : p.isLikedByUser,
                    isFollowedByUser:
                      variables.relationshipType ===
                      ProfileRelationshipType.FOLLOWING
                        ? false
                        : p.isFollowedByUser,
                    likesCount:
                      variables.relationshipType ===
                      ProfileRelationshipType.LIKES
                        ? Math.max((p.likesCount || 0) - 1, 0)
                        : p.likesCount,
                    followersCount:
                      variables.relationshipType ===
                      ProfileRelationshipType.FOLLOWING
                        ? Math.max((p.followersCount || 0) - 1, 0)
                        : p.followersCount,
                  }
                : p,
            ),
          };
          utils.decision.listProposals.setData(
            { processInstanceId: initialProposal.processInstance.id },
            optimisticListData,
          );
        }

        // Optimistically update individual proposal data
        if (previousProposalData) {
          const optimisticProposalData = {
            ...previousProposalData,
            isLikedByUser:
              variables.relationshipType === ProfileRelationshipType.LIKES
                ? false
                : previousProposalData.isLikedByUser,
            isFollowedByUser:
              variables.relationshipType === ProfileRelationshipType.FOLLOWING
                ? false
                : previousProposalData.isFollowedByUser,
            likesCount:
              variables.relationshipType === ProfileRelationshipType.LIKES
                ? Math.max((previousProposalData.likesCount || 0) - 1, 0)
                : previousProposalData.likesCount,
            followersCount:
              variables.relationshipType === ProfileRelationshipType.FOLLOWING
                ? Math.max((previousProposalData.followersCount || 0) - 1, 0)
                : previousProposalData.followersCount,
          };
          utils.decision.getProposal.setData(
            { profileId: currentProposal.profileId },
            optimisticProposalData,
          );
        }

        return { previousListData, previousProposalData };
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousListData && initialProposal.processInstance?.id) {
          utils.decision.listProposals.setData(
            { processInstanceId: initialProposal.processInstance.id },
            context.previousListData,
          );
        }
        if (context?.previousProposalData) {
          utils.decision.getProposal.setData(
            { profileId: currentProposal.profileId },
            context.previousProposalData,
          );
        }
        console.error('Failed to remove relationship:', error);
      },
      onSettled: () => {
        // Always refetch after error or success
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
    addRelationshipMutation.isPending ||
    removeRelationshipMutation.isPending;

  const handleLikeClick = async () => {
    if (!currentProposal.profileId) {
      console.error('No profileId provided for like action');
      return;
    }

    try {
      if (currentProposal.isLikedByUser) {
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

    if (currentProposal.isFollowedByUser) {
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
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Button
        onPress={handleLikeClick}
        size="small"
        color={currentProposal.isLikedByUser ? 'verified' : 'secondary'}
        className="w-full text-nowrap"
        isDisabled={isLoading}
      >
        <Heart className="size-4" />
        {currentProposal.isLikedByUser ? t('Liked') : t('Like')}
      </Button>
      <Button
        onPress={handleFollowClick}
        size="small"
        color={currentProposal.isFollowedByUser ? 'verified' : 'secondary'}
        className="w-full text-nowrap"
        isDisabled={isLoading}
      >
        <LuBookmark className="size-4" />
        {currentProposal.isFollowedByUser ? t('Following') : t('Follow')}
      </Button>
    </div>
  );
}
