'use client';

import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

type Proposal = z.infer<typeof proposalEncoder>;

/**
 * Actions for draft proposals: Edit and Delete buttons.
 * Only shown for proposals with status === 'draft' that belong to the current user.
 */
export function ProposalCardDraftActions({
  proposal,
  instanceId,
  slug,
}: {
  proposal: Proposal;
  instanceId: string;
  slug: string;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const deleteProposalMutation = trpc.decision.deleteProposal.useMutation({
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to delete proposal'),
      });
    },
    onSuccess: () => {
      toast.success({
        message: t('Proposal deleted successfully'),
      });
    },
    onSettled: () => {
      if (proposal.processInstance?.id) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstance.id,
        });
      }
    },
  });

  const handleDeleteConfirm = async () => {
    if (!proposal.id) {
      return;
    }

    try {
      await deleteProposalMutation.mutateAsync({
        proposalId: proposal.id,
      });
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting proposal:', error);
    }
  };

  const editHref = `/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}/edit`;

  return (
    <>
      <div className="flex w-full items-center gap-4">
        <ButtonLink
          href={editHref}
          color="secondary"
          className="w-full text-nowrap"
        >
          <Pencil className="size-4" />
          {t('Edit')}
        </ButtonLink>
        <Button
          onPress={() => setIsDeleteModalOpen(true)}
          color="secondary"
          className="w-full text-nowrap"
          isDisabled={deleteProposalMutation.isPending}
        >
          <Trash2 className="size-4" />
          {t('Delete')}
        </Button>
      </div>
      <DialogTrigger
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
      >
        <Modal
          isDismissable
          isOpen={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
        >
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
              onPress={handleDeleteConfirm}
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
    </>
  );
}
