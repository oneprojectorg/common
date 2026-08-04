'use client';

import { trpc } from '@op/api/client';
import { ProposalStatus, Visibility } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { match } from '@op/core';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

export interface ProposalModerationActions {
  /** Move the proposal onto the voting shortlist. */
  approve: () => void;
  /** Take the proposal off the voting shortlist. */
  reject: () => void;
  /** Flip between hidden and visible. */
  toggleVisibility: () => void;
  isHidden: boolean;
  isShortlisted: boolean;
  isRejected: boolean;
  /** True while either mutation is in flight. */
  isLoading: boolean;
}

/**
 * Admin moderation mutations for a single proposal — shortlist / reject /
 * hide — with the toast copy shared by every surface that offers them
 * (the browse-card kebab and the proposal-page overflow menu).
 *
 * Status changes optimistically patch the `listProposals` cache when the
 * caller's process instance is known, so a card list reorders immediately; on a
 * surface where that query isn't cached the patch is a no-op.
 */
export function useProposalModerationActions(
  proposal: Proposal,
): ProposalModerationActions {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const proposalTitle = proposal.profile.name || t('Untitled Proposal');

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
    approve: () =>
      updateStatusMutation.mutate({
        proposalId: proposal.id,
        data: { status: ProposalStatus.APPROVED },
      }),
    reject: () =>
      updateStatusMutation.mutate({
        proposalId: proposal.id,
        data: { status: ProposalStatus.REJECTED },
      }),
    toggleVisibility: () =>
      updateVisibilityMutation.mutate({
        proposalId: proposal.id,
        data: {
          visibility: isHidden ? Visibility.VISIBLE : Visibility.HIDDEN,
        },
      }),
    isHidden,
    isShortlisted: proposal.status === ProposalStatus.APPROVED,
    isRejected: proposal.status === ProposalStatus.REJECTED,
    isLoading:
      updateStatusMutation.isPending || updateVisibilityMutation.isPending,
  };
}
