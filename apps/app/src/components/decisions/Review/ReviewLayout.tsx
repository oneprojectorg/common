import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
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

  let decisionProfile;
  try {
    [decisionProfile] = await Promise.all([
      client.decision.getDecisionBySlug({ slug: decisionSlug }),
      utils.decision.getReviewAssignment.prefetch({ assignmentId }),
    ]);
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  const allowRevisions =
    decisionProfile.processInstance.instanceData.config
      ?.reviewsAllowRevisions ?? true;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewFormProvider
        assignmentId={assignmentId}
        decisionSlug={decisionSlug}
        allowRevisions={allowRevisions}
      >
        <div className="flex h-dvh flex-col bg-white">
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
              <ReviewRubricForm />
            </SplitPane.Pane>
          </SplitPane>
        </div>
      </ReviewFormProvider>
    </HydrationBoundary>
  );
}
