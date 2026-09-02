'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { useState } from 'react';
import { LuEye, LuEyeOff, LuPencil, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useOpenMergeProposalDialog } from '../MergeProposalDialogContext';
import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from '../ProposalOptionsMenu';
import { RejectProposalDialog } from '../RejectProposalDialog';
import { buildMergeMenuItem } from '../proposals/merge';
import { buildRejectMenuItem } from '../proposals/reject';
import { useProposalModerationActions } from '../useProposalModerationActions';
import { useProposalRejectionActions } from '../useProposalRejectionActions';
import { DeleteProposalDialog } from './DeleteProposalDialog';

// Pre-existing: hoisting the merge dialog took this from CRAP 156 to 132, still
// over the threshold. Cutting it further means restructuring the whole menu.
// fallow-ignore-next-line complexity
export function ProposalCardMenu({
  proposal,
  editHref,
  canManage = false,
}: {
  proposal: Proposal;
  /** Enables the Edit item. Drafts keep their Edit/Delete buttons instead. */
  editHref?: string;
  canManage?: boolean;
}) {
  const t = useTranslations();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  // Owned above the grid, so a list refresh that re-parents this card can't
  // close a merge in progress — see `MergeProposalDialogContext`.
  const openMergeDialog = useOpenMergeProposalDialog();

  const {
    toggleVisibility: handleToggleVisibility,
    isHidden,
    isLoading,
  } = useProposalModerationActions(proposal);

  const mergeEnabled = useFeatureFlag('merge-proposals') ?? false;
  const canMerge =
    mergeEnabled && canManage && proposal.status !== ProposalStatus.DRAFT;

  const rejectEnabled = useFeatureFlag('reject-proposals') ?? false;
  // Shown once submitted; toggles to Undo once rejected, so it stays put.
  const canRejectOrUndo =
    rejectEnabled && canManage && proposal.status !== ProposalStatus.DRAFT;
  const isRejected = proposal.status === ProposalStatus.REJECTED;
  const { reject, unreject, isRejecting, isUnrejecting } =
    useProposalRejectionActions(proposal);

  const getMenuItems = () => {
    const items: ProposalOptionsMenuItem[] = [];

    // Merge leads, per Figma 15311:9078.
    if (canMerge) {
      items.push(
        buildMergeMenuItem({
          isDisabled: isLoading,
          mergeLabel: t('Merge with another proposal'),
          onMerge: () => openMergeDialog(proposal),
        }),
      );
      items.push({
        key: 'visibility',
        icon: isHidden ? (
          <LuEye className="size-5" />
        ) : (
          <LuEyeOff className="size-5" />
        ),
        label: isHidden ? t('Unhide proposal') : t('Hide proposal'),
        onAction: handleToggleVisibility,
        isDisabled: isLoading,
      });
    }

    // Reject sits with merge as an admin curation action (Figma flyout), and
    // becomes Undo once rejected.
    if (canRejectOrUndo) {
      items.push(
        buildRejectMenuItem({
          isDisabled: isLoading || isRejecting || isUnrejecting,
          isRejected,
          rejectLabel: t('Reject proposal'),
          undoLabel: t('Undo rejection'),
          onReject: () => setIsRejectModalOpen(true),
          onUndo: unreject,
        }),
      );
    }

    // Edit is a menu item everywhere except drafts, whose card keeps the
    // Edit/Delete buttons — a draft is unfinished, so finishing it is the
    // point of the card.
    if (proposal.isEditable && editHref) {
      items.push({
        key: 'edit',
        icon: <LuPencil className="size-5" />,
        label: t('Edit'),
        href: editHref,
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
        onAction: () => setIsDeleteModalOpen(true),
        isDisabled: isLoading,
        isDestructive: true,
      });
    }

    return items;
  };

  const menuItems = getMenuItems();

  return (
    <ProposalOptionsMenu
      groups={[menuItems]}
      label={t('Proposal options')}
      triggerProps={{ variant: 'ghost', size: 'icon-xs' }}
    >
      {(proposal.isEditable || canManage) && (
        <DeleteProposalDialog
          proposalId={proposal.id}
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
        />
      )}
      {canRejectOrUndo && !isRejected && (
        <RejectProposalDialog
          open={isRejectModalOpen}
          onOpenChange={setIsRejectModalOpen}
          isPending={isRejecting}
          onConfirm={(input) =>
            reject(input, { onSuccess: () => setIsRejectModalOpen(false) })
          }
        />
      )}
    </ProposalOptionsMenu>
  );
}
