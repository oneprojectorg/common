'use client';

import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { useContext, useState } from 'react';
import { OverlayTriggerStateContext } from 'react-aria-components';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { VoteReviewStep } from './VoteReviewStep';
import { VoteSurveyStep } from './VoteSurveyStep';

// Current specific survey data structure
export interface CurrentSurveyData {
  role: ('member_org' | 'individual' | 'board' | 'staff')[];
  region: string;
  country: string;
}

// Generic custom data type for API
export type CustomData = Record<string, unknown>;

type Proposal = z.infer<typeof proposalEncoder>;

type ModalStep = 'review' | 'survey';

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
  const [currentStep, setCurrentStep] = useState<ModalStep>('review');
  const [surveyData, setSurveyData] = useState<CurrentSurveyData>({
    role: [],
    region: '',
    country: '',
  });

  const utils = trpc.useUtils();
  const submitVoteMutation = trpc.decision.submitVote.useMutation({
    onSuccess: () => {
      utils.decision.getVotingStatus.invalidate();
      overlayState?.close(); // Close the submission modal
      onSuccess(); // Trigger success callback to show success modal
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

  const handleSurveySubmit = (data: CurrentSurveyData) => {
    setSurveyData(data);
    submitVoteMutation.mutate({
      processInstanceId: instanceId,
      selectedProposalIds: selectedProposals.map((p) => p.id),
      schemaVersion: '1.0.0',
      customData: data as unknown as CustomData,
    });
  };

  const getModalTitle = () => {
    switch (currentStep) {
      case 'review':
        return t('Review your votes');
      case 'survey':
        return t('Complete survey');
      default:
        return '';
    }
  };

  return (
    <>
      <ModalHeader>{getModalTitle()}</ModalHeader>
      <ModalBody>
        {currentStep === 'review' && (
          <VoteReviewStep proposals={selectedProposals} maxVotes={maxVotes} />
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
            {t('Continue')}
          </Button>
        </ModalFooter>
      )}
    </>
  );
};
