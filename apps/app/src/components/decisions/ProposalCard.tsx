'use client';

import { getPublicUrl } from '@/utils';
import {
  formatCurrency,
  getTextPreview,
  parseProposalData,
} from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { ProfileRelationshipType } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Surface } from '@op/ui/Surface';
import { Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { LuBookmark } from 'react-icons/lu';
import { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalCardProps {
  proposal: Proposal;
  viewHref: string;
}

export function ProposalCard({
  proposal: initialProposal,
  viewHref,
}: ProposalCardProps) {
  const utils = trpc.useUtils();

  // Get the current proposal data from cache, using initial prop as fallback
  const { data: listData } = trpc.decision.listProposals.useQuery(
    {},
    {
      refetchOnMount: false,
    },
  );

  // Find current proposal in the list data, fallback to initial prop
  const currentProposal =
    listData?.proposals.find((p) => p.id === initialProposal.id) ||
    initialProposal;

  // Parse proposal data using shared utility
  const { title, budget, category, content } = parseProposalData(
    currentProposal.proposalData,
  );

  // Direct tRPC mutations with optimistic updates
  const addRelationshipMutation = trpc.profile.addRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.decision.listProposals.cancel();
      await utils.decision.getProposal.cancel({
        proposalId: currentProposal.id,
      });

      // Snapshot the previous values
      const previousListData = utils.decision.listProposals.getData();
      const previousProposalData = utils.decision.getProposal.getData({
        proposalId: currentProposal.id,
      });

      // Optimistically update list data
      if (previousListData) {
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
                }
              : p,
          ),
        };
        utils.decision.listProposals.setData({}, optimisticListData);
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
        };
        utils.decision.getProposal.setData(
          { proposalId: currentProposal.id },
          optimisticProposalData,
        );
      }

      return { previousListData, previousProposalData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousListData) {
        utils.decision.listProposals.setData({}, context.previousListData);
      }
      if (context?.previousProposalData) {
        utils.decision.getProposal.setData(
          { proposalId: currentProposal.id },
          context.previousProposalData,
        );
      }
      console.error('Failed to add relationship:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.decision.getProposal.invalidate({ proposalId: currentProposal.id });
      utils.decision.listProposals.invalidate();
    },
  });

  const removeRelationshipMutation =
    trpc.profile.removeRelationship.useMutation({
      onMutate: async (variables) => {
        // Cancel outgoing refetches
        await utils.decision.listProposals.cancel();
        await utils.decision.getProposal.cancel({
          proposalId: currentProposal.id,
        });

        // Snapshot the previous values
        const previousListData = utils.decision.listProposals.getData();
        const previousProposalData = utils.decision.getProposal.getData({
          proposalId: currentProposal.id,
        });

        // Optimistically update list data
        if (previousListData) {
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
                  }
                : p,
            ),
          };
          utils.decision.listProposals.setData({}, optimisticListData);
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
          };
          utils.decision.getProposal.setData(
            { proposalId: currentProposal.id },
            optimisticProposalData,
          );
        }

        return { previousListData, previousProposalData };
      },
      onError: (error, _variables, context) => {
        // Rollback on error
        if (context?.previousListData) {
          utils.decision.listProposals.setData({}, context.previousListData);
        }
        if (context?.previousProposalData) {
          utils.decision.getProposal.setData(
            { proposalId: currentProposal.id },
            context.previousProposalData,
          );
        }
        console.error('Failed to remove relationship:', error);
      },
      onSettled: () => {
        // Always refetch after error or success
        utils.decision.getProposal.invalidate({
          proposalId: currentProposal.id,
        });
        utils.decision.listProposals.invalidate();
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
      console.error('Error in ProposalCard handleLikeClick:', error);
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
    <Surface className="p-6">
      {/* Header with title and budget */}
      <div className="mb-3 flex items-start justify-between">
        <Link
          href={viewHref}
          className="text-lg font-semibold text-neutral-charcoal transition-colors hover:text-primary-teal"
        >
          {title || 'Untitled Proposal'}
        </Link>
        {budget && (
          <span className="text-lg font-semibold text-neutral-charcoal">
            {formatCurrency(budget)}
          </span>
        )}
      </div>

      {/* Author and category */}
      <div className="mb-3 flex items-center gap-3">
        {currentProposal.submittedBy && (
          <>
            <Avatar
              placeholder={
                currentProposal.submittedBy.name ||
                currentProposal.submittedBy.slug ||
                'U'
              }
              className="size-6"
            >
              {currentProposal.submittedBy.avatarImage?.name ? (
                <Image
                  src={
                    getPublicUrl(
                      currentProposal.submittedBy.avatarImage.name,
                    ) ?? ''
                  }
                  alt={
                    currentProposal.submittedBy.name ||
                    currentProposal.submittedBy.slug ||
                    ''
                  }
                  fill
                  className="aspect-square object-cover"
                />
              ) : null}
            </Avatar>
            <span className="text-sm text-neutral-charcoal">
              {currentProposal.submittedBy.name ||
                currentProposal.submittedBy.slug}
            </span>
            <span className="text-sm text-neutral-gray2">•</span>
          </>
        )}
        {category && (
          <span className="rounded-full bg-neutral-gray1 px-3 py-1 text-xs text-neutral-charcoal">
            {category}
          </span>
        )}
      </div>

      {/* Description */}
      {content && (
        <p className="mb-4 line-clamp-3 text-sm text-neutral-gray3">
          {getTextPreview(content)}
        </p>
      )}

      {/* Footer with engagement */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-neutral-gray2">
          <button
            onClick={handleLikeClick}
            disabled={isLoading}
            className="flex items-center gap-1 transition-colors hover:text-neutral-charcoal disabled:opacity-50"
          >
            <Heart className="h-4 w-4" />
            <span>{currentProposal.likesCount || 0} Likes</span>
          </button>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            <span>0 Comments</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>0 Followers</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onPress={handleLikeClick} size="small" color="secondary">
            <Heart
              className={`size-4 ${currentProposal.isLikedByUser ? 'fill-current' : ''}`}
            />
            {currentProposal.isLikedByUser ? 'Liked' : 'Like'}
          </Button>
          <Button onPress={handleFollowClick} size="small" color="secondary">
            <LuBookmark
              className={`size-4 ${currentProposal.isFollowedByUser ? 'fill-current' : ''}`}
            />
            {currentProposal.isFollowedByUser ? 'Following' : 'Follow'}
          </Button>
        </div>
      </div>
    </Surface>
  );
}
