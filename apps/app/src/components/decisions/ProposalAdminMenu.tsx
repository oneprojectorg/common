'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { LuCheck, LuEye, LuEyeOff, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from './ProposalOptionsMenu';
import { useProposalModerationActions } from './useProposalModerationActions';

/**
 * Admin overflow menu (`…`) for the proposal page's action row: shortlist /
 * reject from shortlist / hide-unhide. Mirrors the browse-card kebab
 * (`ProposalCard/ProposalCardMenu`) and shares its mutations + toast copy via
 * {@link useProposalModerationActions}, so the two surfaces can't drift.
 *
 * Renders nothing unless the viewer has decision-admin access and the proposal
 * has left draft. Delete is deliberately absent — deleting the proposal you're
 * reading belongs on the card surface, and the Figma menu omits it here.
 */
export function ProposalAdminMenu({ proposal }: { proposal: Proposal }) {
  const t = useTranslations();

  const {
    approve,
    reject,
    toggleVisibility,
    isHidden,
    isShortlisted,
    isRejected,
    isLoading,
  } = useProposalModerationActions(proposal);

  const canModerate =
    proposal.access?.admin === true && proposal.status !== ProposalStatus.DRAFT;

  if (!canModerate) {
    return null;
  }

  const triggerLabel = t('Proposal options');

  // Figma separates the shortlisting actions from the visibility action.
  const shortlistItems: ProposalOptionsMenuItem[] = [
    {
      key: 'approve',
      icon: <LuCheck className="size-5" />,
      label: t('Shortlist for voting'),
      onAction: approve,
      isDisabled: isLoading || isShortlisted,
    },
    {
      key: 'reject',
      icon: <LuX className="size-5" />,
      label: t('Reject from shortlist'),
      onAction: reject,
      isDisabled: isLoading || isRejected,
    },
  ];

  const visibilityItems: ProposalOptionsMenuItem[] = [
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
  ];

  return (
    <ProposalOptionsMenu
      groups={[shortlistItems, visibilityItems]}
      label={triggerLabel}
      triggerProps={{ variant: 'outline', size: 'icon' }}
    />
  );
}
