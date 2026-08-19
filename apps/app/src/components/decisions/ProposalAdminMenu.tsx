'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { useState } from 'react';
import { LuEye, LuEyeOff, LuMerge, LuTrash2 } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { MergeProposalDialog } from './MergeProposalDialog';
import { DeleteProposalDialog } from './ProposalCard/DeleteProposalDialog';
import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from './ProposalOptionsMenu';
import { useProposalModerationActions } from './useProposalModerationActions';

/**
 * Admin overflow menu (`…`) for the proposal page's action row: hide / unhide
 * and delete.
 * Mirrors the browse-card kebab (`ProposalCard/ProposalCardMenu`) and shares its
 * mutation + toast copy via {@link useProposalModerationActions}, so the two
 * surfaces can't drift.
 *
 * The Figma frame also shows shortlist / reject-from-shortlist here, but #1630
 * removed those actions from the app, so they aren't offered on either surface.
 *
 * Renders nothing unless the viewer has decision-admin access and the proposal
 * has left draft.
 */
export function ProposalAdminMenu({
  proposal,
  backHref,
}: {
  proposal: Proposal;
  /** Where to go after deleting — this page is about to 404. */
  backHref: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const { toggleVisibility, isHidden, isLoading } =
    useProposalModerationActions(proposal);

  const canModerate =
    proposal.access?.admin === true && proposal.status !== ProposalStatus.DRAFT;

  if (!canModerate) {
    return null;
  }

  const triggerLabel = t('Proposal options');

  const items: ProposalOptionsMenuItem[] = [
    // Merge leads, matching the card kebab's Figma order (15311:9078).
    {
      key: 'merge',
      icon: <LuMerge className="size-5" />,
      label: t('Merge with another proposal'),
      onAction: () => setIsMergeModalOpen(true),
      isDisabled: isLoading,
    },
    {
      key: 'visibility',
      icon: isHidden ? (
        <LuEye className="size-5" />
      ) : (
        <LuEyeOff className="size-5" />
      ),
      label: isHidden ? t('Unhide proposal') : t('Hide proposal'),
      onAction: toggleVisibility,
      isDisabled: isLoading,
    },
    {
      key: 'delete',
      icon: <LuTrash2 className="size-5" />,
      label: t('Delete'),
      onAction: () => setIsDeleteModalOpen(true),
      isDisabled: isLoading,
      isDestructive: true,
    },
  ];

  return (
    <ProposalOptionsMenu
      groups={[items]}
      label={triggerLabel}
      triggerProps={{ variant: 'outline', size: 'icon' }}
    >
      <DeleteProposalDialog
        proposalId={proposal.id}
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        onDeleted={() => router.push(backHref)}
      />
      <MergeProposalDialog
        proposal={proposal}
        open={isMergeModalOpen}
        onOpenChange={setIsMergeModalOpen}
      />
    </ProposalOptionsMenu>
  );
}
