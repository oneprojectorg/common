'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { useState } from 'react';
import { LuCheck, LuEye, LuEyeOff, LuTrash2, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from '../ProposalOptionsMenu';
import { useProposalModerationActions } from '../useProposalModerationActions';
import { DeleteProposalDialog } from './DeleteProposalDialog';

export function ProposalCardMenu({
  proposal,
  canManage = false,
}: {
  proposal: Proposal;
  canManage?: boolean;
}) {
  const t = useTranslations();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const {
    approve: handleApprove,
    reject: handleReject,
    toggleVisibility: handleToggleVisibility,
    isHidden,
    isShortlisted,
    isRejected,
    isLoading,
  } = useProposalModerationActions(proposal);

  const getMenuItems = () => {
    const items: ProposalOptionsMenuItem[] = [];

    // Admin actions (shortlist, reject, hide) - not for drafts
    if (canManage && proposal.status !== ProposalStatus.DRAFT) {
      items.push({
        key: 'approve',
        icon: <LuCheck className="size-5" />,
        label: t('Shortlist for voting'),
        onAction: handleApprove,
        isDisabled: isLoading || isShortlisted,
      });
      items.push({
        key: 'reject',
        icon: <LuX className="size-5" />,
        label: t('Reject from shortlist'),
        onAction: handleReject,
        isDisabled: isLoading || isRejected,
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
    </ProposalOptionsMenu>
  );
}
