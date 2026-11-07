'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { usePostHog } from 'posthog-js/react';
import { Suspense, useState } from 'react';
import { LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProposal } from '../Proposal/proposalContext';
import { PhaseReviewsSkeleton } from '../ReviewsPanel/PhaseReviews';
import { ReviewsPanel } from '../ReviewsPanel/ReviewsPanel';

/** The sheet proposal's reviews in one phase, as an admin sees them. */
export function ProposalReviewProgress({ phaseId }: { phaseId: string }) {
  const t = useTranslations();

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <p className="py-8 text-center text-base text-muted-foreground">
            {t('decisions.review.loadReviewsError')}
          </p>
        ),
      }}
    >
      <Suspense fallback={<PhaseReviewsSkeleton />}>
        <ProposalReviews phaseId={phaseId} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ProposalReviews({ phaseId }: { phaseId: string }) {
  const t = useTranslations();
  const posthog = usePostHog();
  const { proposal } = useProposal();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const [proposalWithReviews] =
    trpc.decision.getProposalWithReviewAggregates.useSuspenseQuery({
      processInstanceId: proposal.processInstanceId,
      proposalId: proposal.id,
      phaseId,
    });

  const handleSelectAssignment = (reviewAssignmentId: string | null) => {
    if (reviewAssignmentId !== null) {
      posthog.capture(
        'review_viewed',
        getDecisionCommonProperties({
          decisionInstanceId: proposal.processInstanceId,
          proposalId: proposal.id,
          additionalProps: {
            phase_id: phaseId,
            phase_kind: 'current',
            review_assignment_id: reviewAssignmentId,
          },
        }),
      );
    }
    setSelectedAssignmentId(reviewAssignmentId);
  };

  if (proposalWithReviews.aggregates.assignmentsCount === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuUsers className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('decisions.review.noReviewers')}</EmptyTitle>
          <EmptyDescription>
            {t('decisions.review.noReviewersForProposalHint')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ReviewsPanel
      proposalWithReviews={proposalWithReviews}
      rubricTemplate={proposalWithReviews.rubricTemplate}
      selectedAssignmentId={selectedAssignmentId}
      onSelectAssignment={handleSelectAssignment}
      title={null}
      reminderScope={{ processInstanceId: proposal.processInstanceId, phaseId }}
    />
  );
}
