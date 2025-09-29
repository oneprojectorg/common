'use client';

import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { useContext } from 'react';
import { useState } from 'react';
import { OverlayTriggerStateContext } from 'react-aria-components';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { VoteReviewStep } from './VoteReviewStep';
import { VoteSuccessContent } from './VoteSuccessContent';
import { VoteSurveyStep } from './VoteSurveyStep';

export interface SurveyData {
  role: 'member_org' | 'individual' | 'board' | 'staff';
  region: string;
  country: string;
}

type Proposal = z.infer<typeof proposalEncoder>;

type ModalStep = 'review' | 'survey' | 'success';

export const VoteSubmissionModal = ({
  selectedProposals,
  instanceId,
  slug,
  maxVotes,
  onSuccess,
  onShowConfetti,
}: {
  selectedProposals: Proposal[];
  instanceId: string;
  slug: string;
  maxVotes: number;
  onSuccess: () => void;
  onShowConfetti: () => void;
}) => {
  const t = useTranslations();
  const overlayState = useContext(OverlayTriggerStateContext);
  const [currentStep, setCurrentStep] = useState<ModalStep>('review');
  const [surveyData, setSurveyData] = useState<SurveyData>({
    role: 'individual',
    region: '',
    country: '',
  });

  const utils = trpc.useUtils();
  const submitVoteMutation = trpc.decision.submitVote.useMutation({
    onSuccess: () => {
      setCurrentStep('success');
      onShowConfetti(); // Trigger confetti animation
      utils.decision.getVotingStatus.invalidate();
      // Don't call onSuccess() immediately - let the success step handle closing
    },
    onError: (error) => {
      console.error('Failed to submit vote:', error);
      toast.error({
        message: error.message || 'Failed to submit vote',
      });
    },
  });

  const handleReviewContinue = () => {
    setCurrentStep('survey');
  };

  const handleSurveySubmit = (data: SurveyData) => {
    setSurveyData(data);
    submitVoteMutation.mutate({
      processInstanceId: instanceId,
      selectedProposalIds: selectedProposals.map((p) => p.id),
      schemaVersion: '1.0.0',
      surveyData: data,
    });
  };

  const handleClose = () => {
    if (currentStep === 'success') {
      // If closing from success step, trigger the success callback
      onSuccess();
    } else {
      // If closing from other steps, reset modal state
      setCurrentStep('review');
      setSurveyData({
        role: 'individual',
        region: '',
        country: '',
      });
    }
    overlayState?.close();
  };

  const getModalTitle = () => {
    switch (currentStep) {
      case 'review':
        return t('Review your votes');
      case 'survey':
        return t('Complete survey');
      case 'success':
        return '';
      default:
        return '';
    }
  };

  return (
    <>
      {currentStep === 'success' ? (
        <VoteSuccessContent
          onViewProposals={handleClose}
          slug={slug}
          instanceId={instanceId}
        />
      ) : (
        <>
          <ModalHeader>{getModalTitle()}</ModalHeader>
          <ModalBody>
            {currentStep === 'review' && (
              <VoteReviewStep
                proposals={selectedProposals}
                maxVotes={maxVotes}
              />
            )}
            {currentStep === 'survey' && (
              <VoteSurveyStep
                initialData={surveyData}
                isSubmitting={submitVoteMutation.isPending}
                onSubmit={handleSurveySubmit}
              />
            )}
          </ModalBody>
          {currentStep === 'review' && (
            <ModalFooter>
              <Button
                className="w-full"
                color="primary"
                onPress={handleReviewContinue}
              >
                {t('Review and continue')}
              </Button>
            </ModalFooter>
          )}
        </>
      )}
    </>
  );
};
