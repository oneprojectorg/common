'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Header1, Header2 } from '@op/ui/Header';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { SidebarProvider } from '@op/ui/Sidebar';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ReviewExploreFooter } from './ReviewExploreFooter';
import { ReviewExploreNavbar } from './ReviewExploreNavbar';
import {
  ReviewExploreProposalList,
  ReviewExploreSidebar,
  mockReviewProposals,
} from './ReviewExploreSidebar';

interface ReviewExploreLayoutClientProps {
  slug: string;
  reviewId: string;
}

export function ReviewExploreLayoutClient({
  slug,
}: ReviewExploreLayoutClientProps) {
  const t = useTranslations();
  const reviewFlowEnabled = useFeatureFlag('review_flow');
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProposalListOpen, setIsProposalListOpen] = useState(false);

  const handlePrev = () => {};
  const handleNext = () => {};
  const handleSubmit = () => {};
  const activeProposalName =
    mockReviewProposals.find((proposal) => proposal.isActive)?.name ??
    'Community Garden Expansion';

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
      return;
    }

    setIsSidebarOpen(true);
  }, [isMobile]);

  const handleProposalListTrigger = () => {
    if (isMobile) {
      setIsProposalListOpen(true);
      return;
    }

    setIsSidebarOpen((open) => !open);
  };

  if (reviewFlowEnabled === false) {
    notFound();
  }

  return (
    <SidebarProvider isOpen={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
      <div className="flex h-dvh flex-col bg-white">
        <ReviewExploreNavbar
          slug={slug}
          proposalName={activeProposalName}
          isProposalListOpen={isMobile ? isProposalListOpen : isSidebarOpen}
          onOpenProposalList={handleProposalListTrigger}
        />

        <div className="hidden min-h-0 flex-1 sm:flex">
          <ReviewExploreSidebar />

          <div className="flex min-h-0 flex-1">
            <ReviewProposalPane className="border-r p-12" />
            <ReviewRubricPane className="px-12 pt-12 pb-4" />
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
            <ReviewProposalPane />
          </TabPanel>

          <TabPanel
            id="review"
            className="min-h-0 overflow-y-auto px-6 pt-8 pb-4"
          >
            <ReviewRubricPane />
          </TabPanel>
        </Tabs>

        {isMobile && (
          <Sheet
            isOpen={isProposalListOpen}
            onOpenChange={setIsProposalListOpen}
            side="bottom"
            className="sm:hidden"
          >
            <SheetBody className="pb-safe px-4 py-3">
              <ReviewExploreProposalList
                onSelectProposal={() => setIsProposalListOpen(false)}
              />
            </SheetBody>
          </Sheet>
        )}

        <ReviewExploreFooter
          onPrev={handlePrev}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      </div>
    </SidebarProvider>
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
      <Header2 className="text-title-base">Review Proposal</Header2>
    </div>
  );
}
