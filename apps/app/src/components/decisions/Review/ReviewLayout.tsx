import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { CommonError } from '@op/common';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { notFound } from 'next/navigation';

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

  let reviewAssignment;
  try {
    reviewAssignment = await utils.decision.getReviewAssignment.fetch({
      assignmentId,
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  if (!reviewAssignment.rubricTemplate) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewFormProvider
        assignmentId={assignmentId}
        decisionSlug={decisionSlug}
      >
        <div className="flex h-dvh flex-col bg-white">
          <ReviewNavbar decisionSlug={decisionSlug} />

          <div className="mx-auto hidden min-h-0 max-w-5xl flex-1 sm:flex">
            <ReviewProposalPane className="border-r p-12" />
            <div className="min-w-0 flex-1 overflow-y-auto px-12 pt-12 pb-4">
              <ReviewRubricForm />
            </div>
          </div>

          <Tabs
            className="min-h-0 flex-1 gap-0 sm:hidden"
            defaultSelectedKey="review"
          >
            <TabList className="mx-6" variant="default">
              <Tab id="proposal">
                <TranslatedText text="Proposal" />
              </Tab>
              <Tab id="review">
                <TranslatedText text="Review" />
              </Tab>
            </TabList>

            <TabPanel
              id="proposal"
              className="min-h-0 overflow-y-auto px-6 pt-8 pb-4"
            >
              <ReviewProposalPane />
            </TabPanel>

            <TabPanel
              id="review"
              className="min-h-0 overflow-y-auto px-6 pt-8 pb-4"
            >
              <ReviewRubricForm />
            </TabPanel>
          </Tabs>
        </div>
      </ReviewFormProvider>
    </HydrationBoundary>
  );
}
