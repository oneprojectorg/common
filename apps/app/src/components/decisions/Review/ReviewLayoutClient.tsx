'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalPreview } from '../ProposalPreview';
import { ReviewFormProvider } from './ReviewFormContext';
import { ReviewNavbar } from './ReviewNavbar';
import { ReviewRubricForm } from './ReviewRubricForm';

interface ReviewLayoutClientProps {
  decisionSlug: string;
  assignmentId: string;
}

export function ReviewLayoutClient({
  decisionSlug,
  assignmentId,
}: ReviewLayoutClientProps) {
  const reviewFlowEnabled = useFeatureFlag('review_flow');

  if (reviewFlowEnabled === false) {
    notFound();
  }

  return (
    <APIErrorBoundary fallbacks={{ 404: () => notFound() }}>
      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewContent
          decisionSlug={decisionSlug}
          assignmentId={assignmentId}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewContent({
  decisionSlug,
  assignmentId,
}: {
  decisionSlug: string;
  assignmentId: string;
}) {
  const t = useTranslations();

  const [{ assignment, rubricTemplate, review }] =
    trpc.decision.getReviewAssignment.useSuspenseQuery({
      assignmentId,
    });

  if (!rubricTemplate) {
    return null;
  }

  return (
    <ReviewFormProvider
      template={rubricTemplate}
      review={review}
      assignmentId={assignmentId}
      decisionSlug={decisionSlug}
    >
      <div className="flex h-dvh flex-col bg-white">
        <ReviewNavbar decisionSlug={decisionSlug} />

        <div className="mx-auto hidden min-h-0 max-w-5xl flex-1 sm:flex">
          <ReviewProposalPane
            proposal={assignment.proposal}
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
            <ReviewProposalPane proposal={assignment.proposal} />
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
  className,
}: {
  proposal: Parameters<typeof ProposalPreview>[0]['proposal'];
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 flex-1 overflow-y-auto', className)}>
      <ProposalPreview proposal={proposal} />
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6 md:px-8">
        <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-4">
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="hidden flex-1 sm:flex">
        <div className="flex-1 border-r p-12">
          <div className="space-y-4">
            <div className="h-10 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex-1 px-12 pt-12">
          <div className="space-y-6">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
