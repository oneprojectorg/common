'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { LuArrowRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalOptionsMenuItem } from './ProposalOptionsMenu';

/**
 * "Advance to [phase]" for a proposal outside the current phase: the phase it
 * can move into (`undefined` while loading or when it can't move) and the
 * action, shared by the card kebab and the proposal page's menu. Refetched
 * over the proposal channel, so an advance or a rejection clears it.
 */
export function useProposalAdvance({
  proposal,
  enabled = true,
}: {
  proposal: Proposal;
  /** Skip the lookup where the proposal is known to be in the phase. */
  enabled?: boolean;
}) {
  const t = useTranslations();
  const { data: advanceTarget } =
    trpc.decision.getProposalAdvanceTarget.useQuery(
      { proposalId: proposal.id },
      { enabled },
    );
  const advanceMutation = trpc.decision.advanceProposal.useMutation({
    onError: (error) => {
      toast.error(t('decisions.proposals.advanceError'));
      logger.error('Failed to advance proposal', {
        error,
        context: 'useProposalAdvance',
      });
    },
  });

  const advanceItem = (isDisabled: boolean): ProposalOptionsMenuItem | null => {
    if (!enabled || !advanceTarget) {
      return null;
    }
    const { phaseId, phaseName } = advanceTarget;
    return {
      key: 'advance',
      icon: <LuArrowRight className="size-5 rtl:-scale-x-100" />,
      label: t('decisions.proposals.advanceToPhaseAction', {
        phase: phaseName,
      }),
      onAction: () =>
        advanceMutation.mutate(
          { proposalId: proposal.id, phaseId },
          {
            // Per-call so the toast can name the phase it was offered.
            onSuccess: () =>
              toast.success(
                t('decisions.proposals.advanceSuccess', { phase: phaseName }),
              ),
          },
        ),
      isDisabled: isDisabled || advanceMutation.isPending,
    };
  };

  return { advanceItem, isAdvancing: advanceMutation.isPending };
}
