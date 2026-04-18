'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import {
  ProposalReviewRequestState,
  type ReviewAssignmentExtended,
} from '@op/common/client';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { useTranslations } from '@/lib/i18n';

import { ProposalPreview } from '../ProposalPreview';
import { AuthorRevisionNote, RevisedOnBadge } from './AuthorRevisionNote';
import { ReviewFormProvider } from './ReviewFormContext';
import { ReviewNavbar } from './ReviewNavbar';
import { ReviewRubricForm } from './ReviewRubricForm';
import { ReviewSkeleton } from './ReviewSkeleton';

interface ReviewLayoutClientProps {
  decisionSlug: string;
  assignmentId: string;
  initialData: ReviewAssignmentExtended;
}

export function ReviewLayoutClient(props: ReviewLayoutClientProps) {
  return (
    <ErrorBoundary fallback={<ReviewSkeleton />}>
      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewLayoutClientSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function ReviewLayoutClientSuspense({
  decisionSlug,
  assignmentId,
  initialData,
}: ReviewLayoutClientProps) {
  const t = useTranslations();
  const reviewFlowEnabled = useFeatureFlag('review_flow');

  const [reviewAssignment] =
    trpc.decision.getReviewAssignment.useSuspenseQuery(
      { assignmentId },
      { initialData, staleTime: 30 * 1000 },
    );

  if (reviewFlowEnabled === false) {
    notFound();
  }

  const { assignment, rubricTemplate, review, revisionRequest } =
    reviewAssignment;

  if (!rubricTemplate) {
    notFound();
  }

  return (
    <ReviewFormProvider
      template={rubricTemplate}
      review={review}
      revisionRequest={revisionRequest}
      assignmentId={assignmentId}
      decisionSlug={decisionSlug}
    >
      <div className="flex h-dvh flex-col bg-white">
        <ReviewNavbar decisionSlug={decisionSlug} />

        <div className="mx-auto hidden min-h-0 max-w-5xl flex-1 sm:flex">
          <ReviewProposalPane
            proposal={assignment.proposal}
            revisionRequest={revisionRequest}
            className="border-r p-12"
          />
          <div className="min-w-0 flex-1 overflow-y-auto px-12 pt-12 pb-4">
            <ReviewRubricForm template={rubricTemplate} />
          </div>
        </div>

        <Tabs
          className="min-h-0 flex-1 gap-0 sm:hidden"
          defaultSelectedKey="review"
        >
          <TabList className="mx-6" variant="default">
            <Tab id="proposal">{t('Proposal')}</Tab>
            <Tab id="review">{t('Review')}</Tab>
          </TabList>

          <TabPanel
            id="proposal"
            className="min-h-0 overflow-y-auto px-6 pt-8 pb-4"
          >
            <ReviewProposalPane
              proposal={assignment.proposal}
              revisionRequest={revisionRequest}
            />
          </TabPanel>

          <TabPanel
            id="review"
            className="min-h-0 overflow-y-auto px-6 pt-8 pb-4"
          >
            <ReviewRubricForm template={rubricTemplate} />
          </TabPanel>
        </Tabs>
      </div>
    </ReviewFormProvider>
  );
}

function ReviewProposalPane({
  proposal,
  revisionRequest,
  className,
}: {
  proposal: Parameters<typeof ProposalPreview>[0]['proposal'];
  revisionRequest: ReviewAssignmentExtended['revisionRequest'];
  className?: string;
}) {
  const respondedAt =
    revisionRequest?.state === ProposalReviewRequestState.RESUBMITTED
      ? revisionRequest.respondedAt
      : null;
  const responseComment = respondedAt ? revisionRequest?.responseComment : null;

  return (
    <div className={cn('min-w-0 flex-1 overflow-y-auto', className)}>
      <ProposalPreview
        proposal={proposal}
        submissionMetaSuffix={
          respondedAt ? <RevisedOnBadge respondedAt={respondedAt} /> : undefined
        }
        headerBanner={
          responseComment ? (
            <AuthorRevisionNote comment={responseComment} />
          ) : undefined
        }
      />
    </div>
  );
}
