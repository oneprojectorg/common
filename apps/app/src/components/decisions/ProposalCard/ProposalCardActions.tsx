'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Button, ButtonLink } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';
import {
  LuBookmark,
  LuCircleAlert,
  LuHeart,
  LuPencil,
  LuTrash2,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Like/Follow actions for viewing other users' proposals
 */
export function ProposalCardActions({
  proposal: initialProposal,
}: {
  proposal: Proposal;
}) {
  const t = useTranslations();

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
        profileId: currentProposal.profileId,
        processInstanceId: initialProposal.processInstanceId,
      },
    ],
  });

  return (
    <div className="flex w-full items-center gap-4 sm:w-auto">
      <Button
        onPress={handleLikeClick}
        size="small"
        color={isLikedByUser ? 'verified' : 'secondary'}
        className="w-full text-nowrap"
        isDisabled={isLoading}
      >
        <LuHeart className="size-4" />
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

/**
 * Revise proposal action shown to the proposal author during the review phase.
 * Includes the `reviewRevision` query param when a pending revision request
 * exists so the editor opens with the reviewer's feedback in context.
 */
export function ProposalCardReviseAction({
  proposalEditHref,
  revisionRequestId,
}: {
  proposalEditHref: string;
  revisionRequestId?: string;
}) {
  const t = useTranslations();
  const href = revisionRequestId
    ? `${proposalEditHref}?reviewRevision=${revisionRequestId}`
    : proposalEditHref;

  return (
    <ButtonLink href={href} size="small" className="w-full">
      {t('Revise proposal')}
    </ButtonLink>
  );
}

/**
 * Badge shown on a proposal card when the author has a pending revision request.
 */
export function RevisionRequestedBadge() {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-1 rounded-lg bg-functional-yellowWhite px-2 py-1">
      <LuCircleAlert className="size-4 text-primary-orange2" />
      <span className="text-sm text-neutral-charcoal">
        {t('Revision requested')}
      </span>
    </div>
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

  const deleteProposalMutation = trpc.decision.deleteProposal.useMutation({
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to delete proposal'),
      });
    },
    onSuccess: () => {
      toast.success({ message: t('Proposal deleted successfully') });
    },
  });

  const handleDelete = async () => {
    await deleteProposalMutation.mutateAsync({ proposalId: proposal.id });
    setIsDeleteModalOpen(false);
  };

  return (
    <>
      <div className="flex w-full items-center gap-4">
        <ButtonLink
          href={editHref}
          color="secondary"
          size="small"
          className="w-full"
        >
          <LuPencil className="size-4" />
          {t('Edit')}
        </ButtonLink>
        <DialogTrigger
          isOpen={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
        >
          <Button
            onPress={() => setIsDeleteModalOpen(true)}
            color="secondary"
            size="small"
            className="w-full"
            isDisabled={deleteProposalMutation.isPending}
          >
            <LuTrash2 className="size-4" />
            {t('Delete')}
          </Button>
          <Modal isDismissable>
            <ModalHeader>{t('Delete Proposal')}</ModalHeader>
            <ModalBody>
              <p>
                {t(
                  'Are you sure you want to delete this proposal? This action cannot be undone.',
                )}
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                color="secondary"
                className="w-full sm:w-fit"
                onPress={() => setIsDeleteModalOpen(false)}
              >
                {t('Cancel')}
              </Button>
              <Button
                color="destructive"
                onPress={handleDelete}
                className="w-full sm:w-fit"
                isDisabled={deleteProposalMutation.isPending}
              >
                {deleteProposalMutation.isPending
                  ? t('Deleting...')
                  : t('Delete')}
              </Button>
            </ModalFooter>
          </Modal>
        </DialogTrigger>
      </div>
    </>
  );
}
