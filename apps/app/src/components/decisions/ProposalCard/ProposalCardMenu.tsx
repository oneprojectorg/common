'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { useState } from 'react';
import { LuEye, LuEyeOff, LuMerge, LuPencil, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { MergeProposalDialog } from '../MergeProposalDialog';
import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from '../ProposalOptionsMenu';
import { useMergeProposalsEnabled } from '../useProposalMergeActions';
import { useProposalModerationActions } from '../useProposalModerationActions';
import { DeleteProposalDialog } from './DeleteProposalDialog';

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
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const {
    toggleVisibility: handleToggleVisibility,
    isHidden,
    isLoading,
  } = useProposalModerationActions(proposal);

  const mergeEnabled = useMergeProposalsEnabled();
  const canMerge =
    mergeEnabled && canManage && proposal.status !== ProposalStatus.DRAFT;

  const getMenuItems = () => {
    const items: ProposalOptionsMenuItem[] = [];

    // Admin actions (merge, hide) - not for drafts. Merge leads, per Figma
    // 15311:9078.
    if (canMerge) {
      items.push({
        key: 'merge',
        icon: <LuMerge className="size-5" />,
        label: t('Merge with another proposal'),
        onAction: () => setIsMergeModalOpen(true),
        isDisabled: isLoading,
      });
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
      {canMerge && (
        <MergeProposalDialog
          proposal={proposal}
          open={isMergeModalOpen}
          onOpenChange={setIsMergeModalOpen}
        />
      )}
    </ProposalOptionsMenu>
  );
}
