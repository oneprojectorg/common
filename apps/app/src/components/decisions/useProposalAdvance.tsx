'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { LuArrowRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalOptionsMenuItem } from './ProposalOptionsMenu';

/**
 * "Advance to [phase]" for a proposal outside the current phase, shared by the
 * card kebab and the proposal page's menu. A list row already carries its
 * target (`proposal.advanceTarget`); the proposal page looks it up. Either way
 * it's refreshed over the proposal channels, so an advance or a rejection
 * clears it.
 */
export function useProposalAdvance({
  proposal,
  lookUpTarget,
}: {
  proposal: Proposal;
  /** Fetch the target instead of reading it off a list row. */
  lookUpTarget: boolean;
}) {
  const t = useTranslations();
  const { data: fetchedTarget } =
    trpc.decision.getProposalAdvanceTarget.useQuery(
      { proposalId: proposal.id },
      { enabled: lookUpTarget },
    );
  const advanceTarget = lookUpTarget ? fetchedTarget : proposal.advanceTarget;
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
    if (!advanceTarget) {
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
