'use client';

import { parseProposalData } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import { match } from '@op/core';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Menu, MenuItem, MenuSeparator } from '@op/ui/Menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { OptionMenu } from '@op/ui/OptionMenu';
import { toast } from '@op/ui/Toast';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { LuCheck, LuEye, LuEyeOff, LuX } from 'react-icons/lu';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

type Proposal = z.infer<typeof proposalEncoder>;

export function ProposalCardMenu({
  proposal,
  canManage = false,
}: {
  proposal: Proposal;
  canManage?: boolean;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const profileId = proposal.profileId;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const updateStatusMutation = trpc.decision.updateProposalStatus.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      if (proposal.processInstance?.id) {
        await utils.decision.listProposals.cancel({
          processInstanceId: proposal.processInstance.id,
        });
      }

      // Snapshot the previous value
      const previousListData = proposal.processInstance?.id
        ? utils.decision.listProposals.getData({
            processInstanceId: proposal.processInstance.id,
          })
        : null;

      // Optimistically update list data
      if (previousListData && proposal.processInstance?.id) {
        const optimisticListData = {
          ...previousListData,
          proposals: previousListData.proposals.map((p) =>
            p.id === proposal.id
              ? {
                  ...p,
                  status: variables.status,
                }
              : p,
          ),
        };
        utils.decision.listProposals.setData(
          { processInstanceId: proposal.processInstance.id },
          optimisticListData,
        );
      }

      return { previousListData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousListData && proposal.processInstance?.id) {
        utils.decision.listProposals.setData(
          { processInstanceId: proposal.processInstance.id },
          context.previousListData,
        );
      }

      toast.error({
        message: error.message || t('Failed to update proposal status'),
      });
    },
    onSuccess: (_, variables) => {
      const statusMessage = match(variables.status, {
        [ProposalStatus.APPROVED]: t('Proposal shortlisted successfully'),
        [ProposalStatus.REJECTED]: t('Proposal rejected successfully'),
      });

      toast.success({
        message: statusMessage,
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      if (proposal.processInstance?.id) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstance.id,
        });
      }
    },
  });

  const deleteProposalMutation = trpc.decision.deleteProposal.useMutation({
    onError: (error, _variables) => {
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
      // Always refetch after error or success
      if (proposal.processInstance?.id) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstance.id,
        });
      }
    },
  });

  const { title } = parseProposalData(proposal.proposalData);
  const proposalTitle = title || t('Untitled Proposal');

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to update proposal visibility'),
      });
    },
    onSuccess: (_, variables) => {
      if (variables.data.visibility) {
        const message = match(variables.data.visibility, {
          [Visibility.HIDDEN]: `${proposalTitle} ${t('is now hidden from active proposals.')}`,
          [Visibility.VISIBLE]: `${proposalTitle} ${t('is now visible in active proposals.')}`,
        });
        toast.success({ message });
      }
    },
    onSettled: () => {
      if (proposal.processInstance?.id) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstance.id,
        });
      }
    },
  });

  const handleApprove = () => {
    updateStatusMutation.mutate({
      profileId,
      status: ProposalStatus.APPROVED,
    });
  };

  const handleReject = () => {
    updateStatusMutation.mutate({
      profileId,
      status: ProposalStatus.REJECTED,
    });
  };

  const handleToggleVisibility = () => {
    const newVisibility =
      proposal.visibility === Visibility.HIDDEN
        ? Visibility.VISIBLE
        : Visibility.HIDDEN;
    updateProposalMutation.mutate({
      proposalId: proposal.id,
      data: { visibility: newVisibility },
    });
  };

  const isHidden = proposal.visibility === Visibility.HIDDEN;

  const handleDeleteConfirm = async () => {
    if (!proposal.id) {
      console.error('No proposal ID provided for delete action');
      return;
    }

    try {
      await deleteProposalMutation.mutateAsync({
        proposalId: proposal.id,
      });
      setIsDeleteModalOpen(false); // Close modal after successful deletion
    } catch (error) {
      console.error('Error in ProposalCardMenu handleDeleteConfirm:', error);
    }
  };

  const isLoading =
    updateStatusMutation.isPending ||
    deleteProposalMutation.isPending ||
    updateProposalMutation.isPending;

  return (
    <>
      <OptionMenu>
        <Menu className="p-2">
          {/* Admin actions (shortlist, reject, hide) - not for drafts */}
          {canManage && proposal.status !== ProposalStatus.DRAFT && (
            <>
              <MenuItem
                key="approve"
                onAction={handleApprove}
                className="min-w-48 py-2"
                isDisabled={
                  isLoading || proposal.status === ProposalStatus.APPROVED
                }
              >
                <LuCheck className="size-4" />
                {t('Shortlist for voting')}
              </MenuItem>
              <MenuItem
                key="reject"
                onAction={handleReject}
                className="min-w-48 py-2"
                isDisabled={
                  isLoading || proposal.status === ProposalStatus.REJECTED
                }
              >
                <LuX className="size-4" />
                {t('Reject from shortlist')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                key="visibility"
                onAction={handleToggleVisibility}
                className="min-w-48 py-2"
                isDisabled={isLoading}
              >
                {isHidden ? (
                  <LuEye className="size-4" />
                ) : (
                  <LuEyeOff className="size-4" />
                )}
                {isHidden ? t('Unhide proposal') : t('Hide proposal')}
              </MenuItem>
            </>
          )}
          {/* Delete action for own proposals (including drafts) */}
          {proposal.isEditable && (
            <MenuItem
              key="delete"
              onAction={() => setIsDeleteModalOpen(true)}
              className="py-2 text-functional-red"
              isDisabled={isLoading}
            >
              <Trash2 className="size-4" />
              {t('Delete')}
            </MenuItem>
          )}
        </Menu>
      </OptionMenu>
      {proposal.isEditable && (
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
      )}
    </>
  );
}
