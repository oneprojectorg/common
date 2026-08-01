import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { getPhaseReviewSettings } from '@op/common/client';
import { SplitPane } from '@op/ui/SplitPane';
import { forbidden, notFound } from 'next/navigation';

import { TranslatedText } from '@/components/TranslatedText';

import { ReviewFormProvider } from './ReviewFormContext';
import { ReviewNavbar } from './ReviewNavbar';
import { ReviewProposalPane } from './ReviewProposalPane';
import { ReviewRubricForm } from './ReviewRubricForm';

interface ReviewLayoutProps {
  decisionSlug: string;
  assignmentId: string;
}

export async function ReviewLayout({
  decisionSlug,
  assignmentId,
}: ReviewLayoutProps) {
  const [client, { utils, queryClient }] = await Promise.all([
    createClient(),
    createServerUtils(),
  ]);

  let allowRevisions: boolean;
  let openReviews: boolean;
  try {
    const [decisionProfile, reviewAssignment] = await Promise.all([
      client.decision.getDecisionBySlug({ slug: decisionSlug }),
      utils.decision.getReviewAssignment.fetch({ assignmentId }),
    ]);

    // Throws NotFoundError when the assignment's phase is no longer in the
    // instance's phase list (stale assignment) — mapped to notFound() below.
    ({ allowRevisions, openReviews } = getPhaseReviewSettings(
      decisionProfile.processInstance.instanceData,
      reviewAssignment.assignment.phaseId,
    ));
  } catch (error) {
    // tRPC errors carry the CommonError in `cause`; local throws are the error itself.
    const cause =
      error instanceof CommonError
        ? error
        : error instanceof Error
          ? error.cause
          : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewFormProvider
        assignmentId={assignmentId}
        decisionSlug={decisionSlug}
        allowRevisions={allowRevisions}
      >
        <div className="flex h-dvh flex-col overflow-hidden bg-white">
          <ReviewNavbar decisionSlug={decisionSlug} />

          <SplitPane className="mx-auto max-w-6xl" defaultMobileTabId="review">
            <SplitPane.Pane
              id="proposal"
              label={<TranslatedText text="Proposal" />}
            >
              <ReviewProposalPane />
            </SplitPane.Pane>
            <SplitPane.Pane
              id="review"
              label={<TranslatedText text="Review" />}
            >
              <ReviewRubricForm openReviews={openReviews} />
            </SplitPane.Pane>
          </SplitPane>
        </div>
      </ReviewFormProvider>
    </HydrationBoundary>
  );
}
