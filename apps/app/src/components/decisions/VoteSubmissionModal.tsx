'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

import { VoteReviewStep } from './VoteReviewStep';
import type { BallotBudget } from './ballot';

interface VoteSubmissionModalProps {
  /** In ballot order, which is the rank on a ranked vote. */
  selectedProposals: Proposal[];
  ranked: boolean;
  budget?: BallotBudget;
  instanceId: string;
  /**
   * Called after the ballot is accepted. The caller owns the dialog's open
   * state, so it is also responsible for closing it here — sense `Dialog` has
   * no descendant close API beyond `DialogClose`.
   */
  onSuccess: () => void;
}

/**
 * Contents of the "Review your votes" confirmation dialog. Rendered inside the
 * caller's `DialogContent` (see `ProposalsGrid`), so it supplies the header /
 * body / footer parts only.
 */
export const VoteSubmissionModal = ({
  selectedProposals,
  ranked,
  budget,
  instanceId,
  onSuccess,
}: VoteSubmissionModalProps) => {
  const t = useTranslations();

  const utils = trpc.useUtils();
  const submitVoteMutation = trpc.decision.submitVote.useMutation({
    onSuccess: () => {
      utils.decision.getVotingStatus.invalidate();
      // submitVote publishes no channel, so the admin turnout refetches here.
      utils.decision.getVotingProgress.invalidate({
        processInstanceId: instanceId,
      });
      onSuccess();
    },
    onError: (error) => {
      logger.error('Failed to submit vote', {
        error,
        context: 'VoteSubmissionModal.submitVote',
      });
      toast.error(error.message || 'Failed to submit vote');
    },
  });

  const handleSubmit = () => {
    submitVoteMutation.mutate({
      processInstanceId: instanceId,
      selectedProposalIds: selectedProposals.map((p) => p.id),
      schemaVersion: '1.0.0',
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('decisions.proposals.voteReviewTitle')}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-6 px-6 py-8">
        <DialogDescription className="text-foreground">
          {t('decisions.proposals.voteConfirmHint')}
        </DialogDescription>
        <VoteReviewStep
          proposals={selectedProposals}
          ranked={ranked}
          budget={budget}
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t('Cancel')}
        </DialogClose>
        <Button onClick={handleSubmit} loading={submitVoteMutation.isPending}>
          {t('decisions.proposals.submitVotesConfirmAction')}
        </Button>
      </DialogFooter>
    </>
  );
};
