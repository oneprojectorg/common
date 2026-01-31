'use client';

import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import { parseProposalData } from '@op/common/client';
import { match } from '@op/core';
import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { IconButton } from '@op/ui/IconButton';
import { Menu, MenuItem, MenuTrigger } from '@op/ui/Menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Popover } from '@op/ui/Popover';
import { toast } from '@op/ui/Toast';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { LuCheck, LuEllipsis, LuEye, LuEyeOff, LuX } from 'react-icons/lu';
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);

  const updateStatusMutation = trpc.decision.updateProposal.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      if (proposal.processInstanceId) {
        await utils.decision.listProposals.cancel({
          processInstanceId: proposal.processInstanceId,
        });
      }

      // Snapshot the previous value
      const previousListData = proposal.processInstanceId
        ? utils.decision.listProposals.getData({
            processInstanceId: proposal.processInstanceId,
          })
        : null;

      const newStatus = variables.data.status;
      // Optimistically update list data
      if (previousListData && proposal.processInstanceId && newStatus) {
        const optimisticListData = {
          ...previousListData,
          proposals: previousListData.proposals.map((p) =>
            p.id === proposal.id
              ? {
                  ...p,
                  status: newStatus,
                }
              : p,
          ),
        };
        utils.decision.listProposals.setData(
          { processInstanceId: proposal.processInstanceId },
          optimisticListData,
        );
      }

      return { previousListData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousListData && proposal.processInstanceId) {
        utils.decision.listProposals.setData(
          { processInstanceId: proposal.processInstanceId },
          context.previousListData,
        );
      }

      toast.error({
        message: error.message || t('Failed to update proposal status'),
      });
    },
    onSuccess: (_, variables) => {
      if (variables.data.status) {
        const statusMessage = match(variables.data.status, {
          [ProposalStatus.APPROVED]: t('Proposal shortlisted successfully'),
          [ProposalStatus.REJECTED]: t('Proposal rejected successfully'),
        });
        toast.success({ message: statusMessage });
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      if (proposal.processInstanceId) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstanceId,
        });
      }
    },
  });

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
      // Always refetch after error or success
      if (proposal.processInstanceId) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstanceId,
        });
      }
    },
  });

  const { title } = parseProposalData(proposal.proposalData);
  const proposalTitle = title || t('Untitled Proposal');

  const updateVisibilityMutation = trpc.decision.updateProposal.useMutation({
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
      if (proposal.processInstanceId) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstanceId,
        });
      }
    },
  });

  const handleApprove = () => {
    updateStatusMutation.mutate({
      proposalId: proposal.id,
      data: { status: ProposalStatus.APPROVED },
    });
  };

  const handleReject = () => {
    updateStatusMutation.mutate({
      proposalId: proposal.id,
      data: { status: ProposalStatus.REJECTED },
    });
  };

  const handleToggleVisibility = () => {
    const newVisibility =
      proposal.visibility === Visibility.HIDDEN
        ? Visibility.VISIBLE
        : Visibility.HIDDEN;
    updateVisibilityMutation.mutate({
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
    updateVisibilityMutation.isPending;

  const getMenuItems = (forMobile: boolean) => {
    const items: Array<{
      key: string;
      icon: React.ReactNode;
      label: string;
      onAction: () => void;
      isDisabled?: boolean;
      isDestructive?: boolean;
    }> = [];

    // Admin actions (shortlist, reject, hide) - not for drafts
    if (canManage && proposal.status !== ProposalStatus.DRAFT) {
      items.push({
        key: 'approve',
        icon: <LuCheck className="size-5" />,
        label: t('Shortlist for voting'),
        onAction: () => {
          handleApprove();
          setIsMenuSheetOpen(false);
        },
        isDisabled: isLoading || proposal.status === ProposalStatus.APPROVED,
      });
      items.push({
        key: 'reject',
        icon: <LuX className="size-5" />,
        label: t('Reject from shortlist'),
        onAction: () => {
          handleReject();
          setIsMenuSheetOpen(false);
        },
        isDisabled: isLoading || proposal.status === ProposalStatus.REJECTED,
      });
      items.push({
        key: 'visibility',
        icon: isHidden ? (
          <LuEye className="size-5" />
        ) : (
          <LuEyeOff className="size-5" />
        ),
        label: isHidden ? t('Unhide proposal') : t('Hide proposal'),
        onAction: () => {
          handleToggleVisibility();
          setIsMenuSheetOpen(false);
        },
        isDisabled: isLoading,
      });
    }

    // Delete action for own proposals (including drafts)
    if (proposal.isEditable) {
      items.push({
        key: 'delete',
        icon: <Trash2 className="size-5" />,
        label: t('Delete'),
        onAction: () => {
          setIsMenuSheetOpen(false);
          setIsDeleteModalOpen(true);
        },
        isDisabled: isLoading,
        isDestructive: true,
      });
    }

    if (forMobile) {
      return items.map((item, index) => (
        <MenuItem
          key={item.key}
          onAction={item.onAction}
          className={`rounded-none px-6 py-4 ${item.isDestructive ? 'text-functional-red' : ''} ${index < items.length - 1 ? 'border-b border-neutral-gray1' : ''}`}
          isDisabled={item.isDisabled}
        >
          {item.icon}
          {item.label}
        </MenuItem>
      ));
    }

    return items.map((item) => (
      <MenuItem
        key={item.key}
        onAction={item.onAction}
        className={`min-w-48 py-2 ${item.isDestructive ? 'text-functional-red' : ''}`}
        isDisabled={item.isDisabled}
      >
        {item.icon}
        {item.label}
      </MenuItem>
    ));
  };

  const menuTriggerButton = (
    <IconButton
      variant="ghost"
      size="small"
      className="aspect-square aria-expanded:bg-neutral-gray1"
      onPress={isMobile ? () => setIsMenuSheetOpen(true) : undefined}
    >
      <LuEllipsis className="size-4" />
    </IconButton>
  );

  return (
    <>
      {isMobile ? (
        <>
          {menuTriggerButton}
          <Modal
            isOpen={isMenuSheetOpen}
            onOpenChange={setIsMenuSheetOpen}
            isDismissable={true}
            isKeyboardDismissDisabled={false}
            overlayClassName="p-0 items-end justify-center animate-in fade-in-0 duration-300"
            className="m-0 h-auto w-screen max-w-none animate-in rounded-t-2xl rounded-b-none border-0 outline-0 duration-300 ease-out slide-in-from-bottom-full"
          >
            <ModalBody className="pb-safe p-0">
              <Menu className="flex min-w-full flex-col border-0 p-0 shadow-none">
                {getMenuItems(true)}
              </Menu>
            </ModalBody>
          </Modal>
        </>
      ) : (
        <MenuTrigger>
          {menuTriggerButton}
          <Popover placement="bottom end">
            <Menu className="p-2">{getMenuItems(false)}</Menu>
          </Popover>
        </MenuTrigger>
      )}
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
