'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { ProposalStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Menu, MenuItem } from '@op/ui/Menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { OptionMenu } from '@op/ui/OptionMenu';
import { toast } from '@op/ui/Toast';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { LuCheck, LuX } from 'react-icons/lu';
import { z } from 'zod';

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
  const queryClient = useQueryClient();
  const profileId = proposal.profileId;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const updateStatusMutation = useMutation({
    mutationFn: (input: { profileId: string; status: 'approved' | 'rejected' }) =>
      trpc.decision.updateProposalStatus.mutate(input),
    onMutate: async (variables) => {
      if (proposal.processInstance?.id) {
        await queryClient.cancelQueries({
          queryKey: [
            ['decision', 'listProposals'],
            { processInstanceId: proposal.processInstance.id },
          ],
        });
      }

      const previousListData = proposal.processInstance?.id
        ? queryClient.getQueryData([
            ['decision', 'listProposals'],
            { processInstanceId: proposal.processInstance.id },
          ])
        : null;

      if (previousListData && proposal.processInstance?.id) {
        const optimisticListData = {
          ...previousListData,
          proposals: (previousListData as any).proposals.map((p: any) =>
            p.id === proposal.id
              ? {
                  ...p,
                  status: variables.status,
                }
              : p,
          ),
        };
        queryClient.setQueryData(
          [
            ['decision', 'listProposals'],
            { processInstanceId: proposal.processInstance.id },
          ],
          optimisticListData,
        );
      }

      return { previousListData };
    },
    onError: (error, _variables, context) => {
      if (context?.previousListData && proposal.processInstance?.id) {
        queryClient.setQueryData(
          [
            ['decision', 'listProposals'],
            { processInstanceId: proposal.processInstance.id },
          ],
          context.previousListData,
        );
      }

      toast.error({
        message: (error as Error).message || t('Failed to update proposal status'),
      });
    },
    onSuccess: (_, variables) => {
      const statusMessage =
        variables.status === ProposalStatus.APPROVED
          ? t('Proposal shortlisted successfully')
          : t('Proposal rejected successfully');

      toast.success({
        message: statusMessage,
      });
    },
    onSettled: () => {
      if (proposal.processInstance?.id) {
        queryClient.invalidateQueries({
          queryKey: [
            ['decision', 'listProposals'],
            { processInstanceId: proposal.processInstance.id },
          ],
        });
      }
    },
  });

  const deleteProposalMutation = useMutation({
    mutationFn: (input: { proposalId: string }) =>
      trpc.decision.deleteProposal.mutate(input),
    onError: (error, _variables) => {
      toast.error({
        message: (error as Error).message || t('Failed to delete proposal'),
      });
    },
    onSuccess: () => {
      toast.success({
        message: t('Proposal deleted successfully'),
      });
    },
    onSettled: () => {
      if (proposal.processInstance?.id) {
        queryClient.invalidateQueries({
          queryKey: [
            ['decision', 'listProposals'],
            { processInstanceId: proposal.processInstance.id },
          ],
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
    updateStatusMutation.isPending || deleteProposalMutation.isPending;

  return (
    <>
      <OptionMenu>
        <Menu className="p-2">
          {canManage && (
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
            </>
          )}
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
