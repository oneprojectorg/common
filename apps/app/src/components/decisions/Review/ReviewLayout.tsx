import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { SplitPane } from '@op/ui/SplitPane';

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
  const { utils, queryClient } = await createServerUtils();

  await utils.decision.getReviewAssignment.prefetch({ assignmentId });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewFormProvider
        assignmentId={assignmentId}
        decisionSlug={decisionSlug}
      >
        <div className="flex h-dvh flex-col bg-white">
          <ReviewNavbar decisionSlug={decisionSlug} />

          <SplitPane
            className="mx-auto max-w-[68rem]"
            defaultMobileTabId="review"
          >
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
