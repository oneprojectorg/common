'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { useContext } from 'react';
import { OverlayTriggerStateContext } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { VoteReviewStep } from './VoteReviewStep';

export const VoteSubmissionModal = ({
  selectedProposals,
  instanceId,
  maxVotes,
  onSuccess,
}: {
  selectedProposals: Proposal[];
  instanceId: string;
  maxVotes: number;
  onSuccess: () => void;
}) => {
  const t = useTranslations();
  const overlayState = useContext(OverlayTriggerStateContext);

  const utils = trpc.useUtils();
  const submitVoteMutation = trpc.decision.submitVote.useMutation({
    onSuccess: () => {
      utils.decision.getVotingStatus.invalidate();
      overlayState?.close();
      onSuccess();
    },
    onError: (error) => {
      console.error('Failed to submit vote:', error);
      toast.error({
        message: error.message || 'Failed to submit vote',
      });
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
      <ModalHeader>{t('Review your votes')}</ModalHeader>
      <ModalBody>
        <VoteReviewStep proposals={selectedProposals} maxVotes={maxVotes} />
      </ModalBody>
      <ModalFooter>
        <Button
          className="w-full"
          variant="default"
          onPress={handleSubmit}
          isDisabled={submitVoteMutation.isPending}
        >
          {submitVoteMutation.isPending
            ? t('Submitting...')
            : t('Submit my votes')}
        </Button>
      </ModalFooter>
    </>
  );
};
