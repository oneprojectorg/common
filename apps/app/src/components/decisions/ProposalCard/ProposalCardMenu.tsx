'use client';

import { trpc } from '@op/api/client';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { match } from '@op/core';
import { useMediaQuery } from '@op/hooks';
import { logger } from '@op/logging/client';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { IconButton } from '@op/ui/IconButton';
import { Menu, MenuItem, MenuList, MenuTrigger } from '@op/ui/Menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';
import { LuEllipsis, LuEye, LuEyeOff } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function ProposalCardMenu({
  proposal,
  canManage = false,
}: {
  proposal: Proposal;
  canManage?: boolean;
}) {
  const t = useTranslations();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);

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
  });

  const proposalTitle = proposal.profile.name || t('Untitled Proposal');

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
  });

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
      logger.error('No proposal ID provided for delete action', {
        context: 'ProposalCardMenu.delete',
      });
      return;
    }

    try {
      await deleteProposalMutation.mutateAsync({
        proposalId: proposal.id,
      });
      setIsDeleteModalOpen(false); // Close modal after successful deletion
    } catch (error) {
      logger.error('Error in ProposalCardMenu handleDeleteConfirm', {
        error,
        context: 'ProposalCardMenu.handleDeleteConfirm',
      });
    }
  };

  const isLoading =
    deleteProposalMutation.isPending || updateVisibilityMutation.isPending;

  const getMenuItems = () => {
    const items: Array<{
      key: string;
      icon: React.ReactNode;
      label: string;
      onAction: () => void;
      isDisabled?: boolean;
      isDestructive?: boolean;
    }> = [];

    // Admin actions (hide) - not for drafts
    if (canManage && proposal.status !== ProposalStatus.DRAFT) {
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

    // Delete shown for the proposal owner (matching footer Edit/Delete) and for
    // admins, who have delete permission server-side but no Delete elsewhere on
    // non-owned cards.
    if (proposal.isEditable || canManage) {
      items.push({
        key: 'delete',
        icon: <LuTrash2 className="size-5" />,
        label: t('Delete'),
        onAction: () => {
          setIsMenuSheetOpen(false);
          setIsDeleteModalOpen(true);
        },
        isDisabled: isLoading,
        isDestructive: true,
      });
    }

    return items;
  };

  const menuItems = getMenuItems();

  // Don't render the menu at all if there are no items
  if (menuItems.length === 0) {
    return null;
  }

  const renderMenuItems = (forMobile: boolean) => {
    const items = menuItems;

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
      aria-label={t('Proposal options')}
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
            overlayClassName="animate-in items-end justify-center p-0 duration-300 fade-in-0"
            className="m-0 h-auto w-screen max-w-none animate-in rounded-t-2xl rounded-b-none border-0 outline-0 duration-300 ease-out slide-in-from-bottom-full"
          >
            <ModalBody className="pb-safe p-0">
              <MenuList className="flex min-w-full flex-col border-0 p-0 shadow-none">
                {renderMenuItems(true)}
              </MenuList>
            </ModalBody>
          </Modal>
        </>
      ) : (
        <MenuTrigger>
          {menuTriggerButton}
          <Menu className="p-2" placement="bottom end">
            {renderMenuItems(false)}
          </Menu>
        </MenuTrigger>
      )}
      {(proposal.isEditable || canManage) && (
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
