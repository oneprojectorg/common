'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

export interface ProposalRejectionActions {
  /**
   * Reject the proposal. `onSuccess` runs after it resolves — e.g. the confirm
   * dialog uses it to close itself.
   */
  reject: (options?: { onSuccess?: () => void }) => void;
  /** Restore a rejected proposal to the active pool. */
  unreject: () => void;
  isRejecting: boolean;
  isUnrejecting: boolean;
}

/**
 * Reject / undo-reject for a single proposal, with the toast copy shared by
 * every surface that offers them — the card kebab, the proposal-page overflow
 * menu, and the reject success toast's inline Undo action. One hook so the
 * toast's Undo and the menu's Undo item hit the same endpoint with the same
 * copy. No invalidation needed: both endpoints register the proposal channels.
 */
export function useProposalRejectionActions(
  proposal: Proposal,
): ProposalRejectionActions {
  const t = useTranslations();

  const unrejectMutation = trpc.decision.unrejectProposal.useMutation({
    onError: (error) => {
      toast.error(
        error.message || t('Could not undo the rejection. Please try again.'),
      );
    },
    onSuccess: () => {
      toast.success(t('Rejection undone'));
    },
  });

  const unreject = () => unrejectMutation.mutate({ proposalId: proposal.id });

  const rejectMutation = trpc.decision.rejectProposal.useMutation({
    onError: (error) => {
      toast.error(
        error.message || t('Could not reject this proposal. Please try again.'),
      );
    },
    onSuccess: () => {
      // Inline Undo so a mis-click is one tap to reverse, per the design.
      toast.success(t('Proposal rejected'), {
        action: { label: t('Undo'), onClick: unreject },
      });
    },
  });

  return {
    reject: (options) =>
      rejectMutation.mutate(
        { proposalId: proposal.id },
        { onSuccess: options?.onSuccess },
      ),
    unreject,
    isRejecting: rejectMutation.isPending,
    isUnrejecting: unrejectMutation.isPending,
  };
}
