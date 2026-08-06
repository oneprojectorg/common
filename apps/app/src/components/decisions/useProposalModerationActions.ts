'use client';

import { trpc } from '@op/api/client';
import { Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { match } from '@op/core';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

export interface ProposalModerationActions {
  /** Flip between hidden and visible. */
  toggleVisibility: () => void;
  isHidden: boolean;
  /** True while the mutation is in flight. */
  isLoading: boolean;
}

/**
 * Admin moderation for a single proposal — hide / unhide — with the toast copy
 * shared by every surface that offers it (the browse-card kebab and the
 * proposal-page overflow menu).
 *
 * Shortlist / reject lived here too until #1630 removed those actions from the
 * app; only the `SHORTLISTED` list filter survives, and it's URL-driven.
 */
export function useProposalModerationActions(
  proposal: Proposal,
): ProposalModerationActions {
  const t = useTranslations();

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

  const isHidden = proposal.visibility === Visibility.HIDDEN;

  return {
    toggleVisibility: () =>
      updateVisibilityMutation.mutate({
        proposalId: proposal.id,
        data: {
          visibility: isHidden ? Visibility.VISIBLE : Visibility.HIDDEN,
        },
      }),
    isHidden,
    isLoading: updateVisibilityMutation.isPending,
  };
}
