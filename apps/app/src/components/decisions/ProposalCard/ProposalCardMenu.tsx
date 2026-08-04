'use client';

import { trpc } from '@op/api/client';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { match } from '@op/core';
import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@op/sense/Sheet';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import { useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';
import { LuCheck, LuEllipsis, LuEye, LuEyeOff, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DeleteProposalDialog } from './DeleteProposalDialog';

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
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
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

      toast.error(error.message || t('Failed to update proposal status'));
    },
    onSuccess: (_, variables) => {
      if (variables.data.status) {
        const statusMessage = match(variables.data.status, {
          [ProposalStatus.APPROVED]: t('Proposal shortlisted successfully'),
          [ProposalStatus.REJECTED]: t('Proposal rejected successfully'),
        });
        toast.success(statusMessage);
      }
    },
  });

  const proposalTitle = proposal.profile.name || t('Untitled Proposal');

  const updateVisibilityMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => {
      toast.error(error.message || t('Failed to update proposal visibility'));
    },
    onSuccess: (_, variables) => {
      if (variables.data.visibility) {
        const message = match(variables.data.visibility, {
          [Visibility.HIDDEN]: `${proposalTitle} ${t('is now hidden from active proposals.')}`,
          [Visibility.VISIBLE]: `${proposalTitle} ${t('is now visible in active proposals.')}`,
        });
        toast.success(message);
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

  const isLoading =
    updateStatusMutation.isPending || updateVisibilityMutation.isPending;

  const getMenuItems = () => {
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

  const triggerLabel = t('Proposal options');

  return (
    <>
      {isMobile ? (
        <>
          <Button
            aria-label={triggerLabel}
            variant="ghost"
            size="icon-xs"
            className="aspect-square aria-expanded:bg-muted"
            onClick={() => setIsMenuSheetOpen(true)}
          >
            <LuEllipsis className="size-4" />
          </Button>
          <Sheet open={isMenuSheetOpen} onOpenChange={setIsMenuSheetOpen}>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="rounded-t-2xl p-0"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>{triggerLabel}</SheetTitle>
              </SheetHeader>
              <div className="pb-safe flex min-w-full flex-col">
                {menuItems.map((item, index) => (
                  <Button
                    key={item.key}
                    variant="ghost"
                    onClick={item.onAction}
                    disabled={item.isDisabled}
                    className={cn(
                      'h-auto w-full justify-start gap-2 rounded-none px-6 py-4',
                      item.isDestructive && 'text-destructive',
                      index < menuItems.length - 1 && 'border-b border-border',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={triggerLabel}
                variant="ghost"
                size="icon-xs"
                className="aspect-square aria-expanded:bg-muted"
              >
                <LuEllipsis className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent side="bottom" align="end" className="p-2">
            {menuItems.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onClick={item.onAction}
                disabled={item.isDisabled}
                variant={item.isDestructive ? 'destructive' : 'default'}
                className="min-w-48"
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {(proposal.isEditable || canManage) && (
        <DeleteProposalDialog
          proposalId={proposal.id}
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
        />
      )}
    </>
  );
}
