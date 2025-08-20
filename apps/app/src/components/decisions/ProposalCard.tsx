'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency, getTextPreview, parseProposalData } from '@/utils/proposalUtils';
import type { proposalEncoder } from '@op/api/encoders';
import { trpc } from '@op/api/client';
import { ProfileRelationshipType } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Surface } from '@op/ui/Surface';
import { Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalCardProps {
  proposal: Proposal;
  viewHref: string;
}

export function ProposalCard({ proposal, viewHref }: ProposalCardProps) {
  // Parse proposal data using shared utility
  const { title, budget, category, content } = parseProposalData(proposal.proposalData);

  const utils = trpc.useUtils();

  // Direct tRPC mutations with optimistic updates
  const addRelationshipMutation = trpc.profile.addRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.decision.listProposals.cancel();

      // Snapshot the previous value
      const previousData = utils.decision.listProposals.getData();

      // Optimistically update list data
      if (previousData) {
        const optimisticData = {
          ...previousData,
          proposals: previousData.proposals.map((p) => 
            p.id === proposal.id 
              ? {
                  ...p,
                  isLikedByUser: variables.relationshipType === ProfileRelationshipType.LIKES ? true : p.isLikedByUser,
                  isFollowedByUser: variables.relationshipType === ProfileRelationshipType.FOLLOWING ? true : p.isFollowedByUser,
                }
              : p
          )
        };
        utils.decision.listProposals.setData({}, optimisticData);
      }

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.decision.listProposals.setData({}, context.previousData);
      }
      console.error('Failed to add relationship:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.decision.getProposal.invalidate({ proposalId: proposal.id });
      utils.decision.listProposals.invalidate();
    },
  });

  const removeRelationshipMutation = trpc.profile.removeRelationship.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.decision.listProposals.cancel();

      // Snapshot the previous value
      const previousData = utils.decision.listProposals.getData();

      // Optimistically update list data
      if (previousData) {
        const optimisticData = {
          ...previousData,
          proposals: previousData.proposals.map((p) => 
            p.id === proposal.id 
              ? {
                  ...p,
                  isLikedByUser: variables.relationshipType === ProfileRelationshipType.LIKES ? false : p.isLikedByUser,
                  isFollowedByUser: variables.relationshipType === ProfileRelationshipType.FOLLOWING ? false : p.isFollowedByUser,
                }
              : p
          )
        };
        utils.decision.listProposals.setData({}, optimisticData);
      }

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.decision.listProposals.setData({}, context.previousData);
      }
      console.error('Failed to remove relationship:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.decision.getProposal.invalidate({ proposalId: proposal.id });
      utils.decision.listProposals.invalidate();
    },
  });

  const isLoading = addRelationshipMutation.isPending || removeRelationshipMutation.isPending;

  const handleLikeClick = async () => {
    console.log('ProposalCard handleLikeClick called', { 
      profileId: proposal.profileId, 
      isLikedByUser: proposal.isLikedByUser 
    });

    if (!proposal.profileId) {
      console.error('No profileId provided for like action');
      return;
    }

    try {
      if (proposal.isLikedByUser) {
        console.log('Unliking proposal (ProposalCard)...');
        // Unlike
        await removeRelationshipMutation.mutateAsync({
          targetProfileId: proposal.profileId,
          relationshipType: ProfileRelationshipType.LIKES,
        });
      } else {
        console.log('Liking proposal (ProposalCard)...');
        // Like
        await addRelationshipMutation.mutateAsync({
          targetProfileId: proposal.profileId,
          relationshipType: ProfileRelationshipType.LIKES,
          pending: false,
        });
      }
    } catch (error) {
      console.error('Error in ProposalCard handleLikeClick:', error);
    }
  };

  const handleFollowClick = async () => {
    if (!proposal.profileId) {
      console.error('No profileId provided for follow action');
      return;
    }

    if (proposal.isFollowedByUser) {
      // Unfollow
      await removeRelationshipMutation.mutateAsync({
        targetProfileId: proposal.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
      });
    } else {
      // Follow
      await addRelationshipMutation.mutateAsync({
        targetProfileId: proposal.profileId,
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
          className="text-lg font-semibold text-neutral-charcoal hover:text-primary-teal transition-colors"
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
        {proposal.submittedBy && (
          <>
            <Avatar
              placeholder={proposal.submittedBy.name || proposal.submittedBy.slug || 'U'}
              className="h-6 w-6"
            >
              {proposal.submittedBy.avatarImage?.name ? (
                <Image
                  src={getPublicUrl(proposal.submittedBy.avatarImage.name) ?? ''}
                  alt={proposal.submittedBy.name || proposal.submittedBy.slug || ''}
                  fill
                  className="aspect-square object-cover"
                />
              ) : null}
            </Avatar>
            <span className="text-sm text-neutral-charcoal">
              {proposal.submittedBy.name || proposal.submittedBy.slug}
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
        <p className="mb-4 text-sm text-neutral-gray3 line-clamp-3">
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
            <span>0 Likes</span>
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
          <button
            onClick={handleLikeClick}
            disabled={isLoading || !proposal.profileId}
            className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              proposal.isLikedByUser
                ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
                : 'border-primary-teal text-primary-teal hover:bg-primary-teal hover:text-white'
            }`}
          >
            <Heart className={`h-4 w-4 ${proposal.isLikedByUser ? 'fill-current' : ''}`} />
            {proposal.isLikedByUser ? 'Liked' : 'Like'}
          </button>
          <button
            onClick={handleFollowClick}
            disabled={isLoading || !proposal.profileId}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              proposal.isFollowedByUser
                ? 'border-primary-teal bg-primary-teal text-white hover:bg-primary-teal-dark'
                : 'border-neutral-gray1 text-neutral-charcoal hover:bg-neutral-gray1'
            }`}
          >
            {proposal.isFollowedByUser ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>
    </Surface>
  );
}