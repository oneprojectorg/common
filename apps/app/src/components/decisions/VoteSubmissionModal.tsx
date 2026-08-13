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

interface VoteSubmissionModalProps {
  selectedProposals: Proposal[];
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
  instanceId,
  onSuccess,
}: VoteSubmissionModalProps) => {
  const t = useTranslations();

  const utils = trpc.useUtils();
  const submitVoteMutation = trpc.decision.submitVote.useMutation({
    onSuccess: () => {
      utils.decision.getVotingStatus.invalidate();
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
        <DialogTitle>{t('Review your votes')}</DialogTitle>
        <DialogDescription>
          {t('Please confirm your selections before submitting')}
        </DialogDescription>
      </DialogHeader>

      <div className="px-6 py-4">
        <VoteReviewStep proposals={selectedProposals} />
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t('Cancel')}
        </DialogClose>
        <Button onClick={handleSubmit} loading={submitVoteMutation.isPending}>
          {t('Submit votes')}
        </Button>
      </DialogFooter>
    </>
  );
};
