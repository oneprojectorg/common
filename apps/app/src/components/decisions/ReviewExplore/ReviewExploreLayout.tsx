'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { SidebarProvider } from '@op/ui/Sidebar';
import { notFound } from 'next/navigation';

import { ReviewExploreFooter } from './ReviewExploreFooter';
import { ReviewExploreNavbar } from './ReviewExploreNavbar';
import { ReviewExploreSidebar } from './ReviewExploreSidebar';

interface ReviewExploreLayoutProps {
  slug: string;
  reviewId: string;
}

export function ReviewExploreLayout({ slug }: ReviewExploreLayoutProps) {
  const reviewFlowEnabled = useFeatureFlag('review_flow');

  if (reviewFlowEnabled === false) {
    notFound();
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-dvh flex-col bg-white">
        <ReviewExploreNavbar slug={slug} />

        <div className="flex min-h-0 flex-1">
          <ReviewExploreSidebar />

          <div className="flex min-h-0 flex-1">
            {/* Proposal viewer */}
            <div className="flex-1 overflow-y-auto border-r p-12">
              <h1 className="text-title-lg text-neutral-black">
                Community Garden Expansion
              </h1>
            </div>

            {/* Review form */}
            <div className="flex-1 overflow-y-auto px-12 pt-12 pb-4">
              <h2 className="text-title-base text-neutral-black">
                Review Proposal
              </h2>
            </div>
          </div>
        </div>

        <ReviewExploreFooter />
      </div>
    </SidebarProvider>
  );
}
