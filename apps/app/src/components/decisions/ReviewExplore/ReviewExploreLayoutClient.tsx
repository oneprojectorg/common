'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Header1 } from '@op/ui/Header';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

import { ReviewExploreNavbar } from './ReviewExploreNavbar';
import { ReviewRubricForm } from './ReviewRubricForm';
import { REVIEW_RUBRIC_DUMMY_TEMPLATE } from './reviewRubricDummyTemplate';

interface ReviewExploreLayoutClientProps {
  slug: string;
  reviewId: string;
}

export function ReviewExploreLayoutClient({
  slug,
}: ReviewExploreLayoutClientProps) {
  const t = useTranslations();
  const reviewFlowEnabled = useFeatureFlag('review_flow');

  if (reviewFlowEnabled === false) {
    notFound();
  }

  return (
    <div className="flex h-dvh flex-col bg-white">
      <ReviewExploreNavbar slug={slug} />

      <div className="mx-auto hidden min-h-0 max-w-5xl flex-1 sm:flex">
        <ReviewProposalPane className="border-r p-12" />
        <ReviewRubricPane className="px-12 pt-12 pb-4" />
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
          <ReviewProposalPane />
        </TabPanel>

        <TabPanel
          id="review"
          className="min-h-0 overflow-y-auto px-6 pt-8 pb-4"
        >
          <ReviewRubricPane />
        </TabPanel>
      </Tabs>
    </div>
  );
}

function ReviewProposalPane({ className }: { className?: string }) {
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <Header1 className="font-sans">Community Garden Expansion</Header1>
    </div>
  );
}

function ReviewRubricPane({ className }: { className?: string }) {
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <ReviewRubricForm template={REVIEW_RUBRIC_DUMMY_TEMPLATE} />
    </div>
  );
}
