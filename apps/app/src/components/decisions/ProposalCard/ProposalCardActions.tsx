'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { useState } from 'react';
import { LuBookmark, LuHeart, LuPencil, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { DeleteProposalDialog } from './DeleteProposalDialog';

/**
 * Like/Follow actions for viewing other users' proposals
 */
export function ProposalCardActions({
  proposal: initialProposal,
}: {
  proposal: Proposal;
}) {
  const t = useTranslations();
  const { user } = useUser();

  // Subscribe to the individual proposal data which gets optimistically updated
  const { data: currentProposal } = trpc.decision.getProposal.useQuery(
    { profileId: initialProposal.profileId },
    {
      refetchOnMount: false,
      initialData: initialProposal,
    },
  );

  // Use relationship mutations hook for like/follow functionality
  const {
    isLiked: isLikedByUser,
    isFollowed: isFollowedByUser,
    isLoading,
    handleLike: handleLikeClick,
    handleFollow: handleFollowClick,
  } = useRelationshipMutations({
    targetProfileId: currentProposal.profileId,
    invalidateQueries: [
      {
        processInstanceId: initialProposal.processInstanceId,
      },
    ],
  });

  // Like/Follow are user-scoped writes gated at the API — anonymous visitors
  // can read the proposal but aren't offered these actions.
  if (!userCanInteract(user)) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-4">
      {/* TODO(sense-migration): @op/ui `color="verified"` (teal-tinted active
          state) has no sense Button variant; `default` (solid teal) preserves
          the liked/unliked distinction — revisit against Figma. */}
      <Button
        onClick={handleLikeClick}
        size="sm"
        variant={isLikedByUser ? 'default' : 'outline'}
        className="flex-1 text-nowrap"
        disabled={isLoading}
      >
        <LuHeart className="size-4" />
        {isLikedByUser ? t('Liked') : t('Like')}
      </Button>
      <Button
        onClick={handleFollowClick}
        size="sm"
        variant={isFollowedByUser ? 'default' : 'outline'}
        className="flex-1 text-nowrap"
        disabled={isLoading}
      >
        <LuBookmark className="size-4" />
        {isFollowedByUser ? t('Following') : t('Follow')}
      </Button>
    </div>
  );
}

export function ProposalCardReviseAction({
  editHref,
  className,
}: {
  editHref: string;
  className?: string;
}) {
  const t = useTranslations();
  const [navigating, setNavigating] = useState(false);

  return (
    <ButtonLink
      href={editHref}
      variant="default"
      size="sm"
      className={`w-full${className ? ` ${className}` : ''}`}
      onClick={() => setNavigating(true)}
      loading={navigating}
    >
      {t('Revise proposal')}
    </ButtonLink>
  );
}

/**
 * Edit/Delete actions for the proposal owner
 */
export function ProposalCardOwnerActions({
  proposal,
  editHref,
}: {
  proposal: Proposal;
  editHref: string;
}) {
  const t = useTranslations();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  return (
    <div className="flex w-full items-center gap-4">
      <ButtonLink
        href={editHref}
        variant="outline"
        size="sm"
        className="flex-1"
      >
        <LuPencil className="size-4" />
        {t('Edit')}
      </ButtonLink>
      <DeleteProposalDialog
        proposalId={proposal.id}
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        trigger={
          <Button variant="destructive" size="sm" className="flex-1">
            <LuTrash2 className="size-4" />
            {t('Delete')}
          </Button>
        }
      />
    </div>
  );
}
