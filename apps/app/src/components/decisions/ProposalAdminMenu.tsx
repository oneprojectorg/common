'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { LuEye, LuEyeOff } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalOptionsMenu,
  type ProposalOptionsMenuItem,
} from './ProposalOptionsMenu';
import { useProposalModerationActions } from './useProposalModerationActions';

/**
 * Admin overflow menu (`…`) for the proposal page's action row: hide / unhide.
 * Mirrors the browse-card kebab (`ProposalCard/ProposalCardMenu`) and shares its
 * mutation + toast copy via {@link useProposalModerationActions}, so the two
 * surfaces can't drift.
 *
 * The Figma frame also shows shortlist / reject-from-shortlist here, but #1630
 * removed those actions from the app, so they aren't offered on either surface.
 *
 * Renders nothing unless the viewer has decision-admin access and the proposal
 * has left draft. Delete is deliberately absent — deleting the proposal you're
 * reading belongs on the card surface, and the Figma menu omits it here.
 */
export function ProposalAdminMenu({ proposal }: { proposal: Proposal }) {
  const t = useTranslations();

  const { toggleVisibility, isHidden, isLoading } =
    useProposalModerationActions(proposal);

  const canModerate =
    proposal.access?.admin === true && proposal.status !== ProposalStatus.DRAFT;

  if (!canModerate) {
    return null;
  }

  const triggerLabel = t('Proposal options');

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
      groups={[visibilityItems]}
      label={triggerLabel}
      triggerProps={{ variant: 'outline', size: 'icon' }}
    />
  );
}
