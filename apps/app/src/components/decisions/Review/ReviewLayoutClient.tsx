'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import type { RubricTemplateSchema } from '@op/common/client';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

import { ProposalPreview } from '../ProposalPreview';
import { ReviewNavbar } from './ReviewNavbar';
import { ReviewRubricForm } from './ReviewRubricForm';

export function ReviewContent({
  decisionSlug,
  reviewId,
}: {
  decisionSlug: string;
  reviewId: string;
}) {
  const reviewFlowEnabled = useFeatureFlag('review_flow');

  if (reviewFlowEnabled === false) {
    notFound();
  }

  const t = useTranslations();

  const [{ assignment, rubricTemplate }] =
    trpc.decision.getReviewAssignment.useSuspenseQuery({
      assignmentId: reviewId,
    });

  return (
    <div className="flex h-dvh flex-col bg-white">
      <ReviewNavbar decisionSlug={decisionSlug} />

      <div className="mx-auto hidden min-h-0 max-w-5xl flex-1 sm:flex">
        <ReviewProposalPane
          proposal={assignment.proposal}
          className="border-r p-12"
        />
        <ReviewRubricPane
          rubricTemplate={rubricTemplate}
          className="px-12 pt-12 pb-4"
        />
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
          <ReviewRubricPane rubricTemplate={rubricTemplate} />
        </TabPanel>
      </Tabs>
    </div>
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

function ReviewRubricPane({
  rubricTemplate,
  className,
}: {
  rubricTemplate: RubricTemplateSchema | null;
  className?: string;
}) {
  if (!rubricTemplate) {
    return null;
  }

  return (
    <div className={cn('min-w-0 flex-1 overflow-y-auto', className)}>
      <ReviewRubricForm template={rubricTemplate} />
    </div>
  );
}
