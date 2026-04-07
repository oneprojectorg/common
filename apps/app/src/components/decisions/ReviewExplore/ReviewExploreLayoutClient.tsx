'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import type {
  ListProposalReviewAssignmentsResult,
  ProposalTemplateSchema,
  RubricTemplateSchema,
} from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Header1 } from '@op/ui/Header';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { SidebarProvider } from '@op/ui/Sidebar';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { notFound, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalViewContent } from '../ProposalViewContent';
import { resolveProposalSystemFields } from '../proposalContentUtils';
import { ReviewExploreFooter } from './ReviewExploreFooter';
import { ReviewExploreNavbar } from './ReviewExploreNavbar';
import {
  ReviewExploreProposalList,
  ReviewExploreSidebar,
  type ReviewStatus,
  type SidebarProposal,
} from './ReviewExploreSidebar';
import { ReviewRubricForm } from './ReviewRubricForm';

type ReviewAssignmentStatus =
  ListProposalReviewAssignmentsResult['assignments'][number]['status'];
type ReviewAssignment =
  ListProposalReviewAssignmentsResult['assignments'][number];

interface ReviewExploreLayoutClientProps {
  slug: string;
  reviewId: string;
}

export function ReviewExploreLayoutClient({
  slug,
  reviewId,
}: ReviewExploreLayoutClientProps) {
  const t = useTranslations();
  const reviewFlowEnabled = useFeatureFlag('review_flow');
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProposalListOpen, setIsProposalListOpen] = useState(false);

  const { data: decisionProfile } = trpc.decision.getDecisionBySlug.useQuery({
    slug,
  });

  const processInstanceId = decisionProfile?.processInstance?.id;

  const { data: reviewAssignments } =
    trpc.decision.listReviewAssignments.useQuery(
      {
        processInstanceId: processInstanceId ?? '',
      },
      {
        enabled: Boolean(processInstanceId),
      },
    );

  const { data: activeAssignmentData } =
    trpc.decision.getReviewAssignment.useQuery(
      { assignmentId: reviewId },
      { enabled: Boolean(reviewId) },
    );

  const activeAssignment = activeAssignmentData?.assignment;
  const rubricTemplate = activeAssignmentData?.rubricTemplate as
    | RubricTemplateSchema
    | null
    | undefined;

  const sidebarProposals: SidebarProposal[] =
    reviewAssignments?.assignments.map((assignment) => ({
      id: assignment.id,
      name:
        resolveProposalSystemFields(assignment.proposal).title ??
        assignment.proposal.profile.name,
      reviewStatus: getReviewStatus(assignment.status),
      isActive: assignment.id === reviewId,
    })) ?? [];

  const handlePrev = () => {};
  const handleNext = () => {};
  const handleSubmit = () => {};
  const activeProposalName =
    sidebarProposals.find((proposal) => proposal.isActive)?.name ??
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

  const handleSelectProposal = (proposal: SidebarProposal) => {
    router.push(`/decisions/${slug}/reviews/${proposal.id}`);
    setIsProposalListOpen(false);
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
          <ReviewExploreSidebar
            proposals={sidebarProposals}
            onSelectProposal={handleSelectProposal}
          />

          <div className="flex min-h-0 flex-1">
            <ReviewProposalPane
              assignment={activeAssignment}
              className="border-r"
            />
            <ReviewRubricPane
              rubricTemplate={rubricTemplate}
              className="px-12 pt-12 pb-4"
            />
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
            <ReviewProposalPane assignment={activeAssignment} />
          </TabPanel>

          <TabPanel
            id="review"
            className="min-h-0 overflow-y-auto px-6 pt-8 pb-4"
          >
            <ReviewRubricPane rubricTemplate={rubricTemplate} />
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
                proposals={sidebarProposals}
                onSelectProposal={handleSelectProposal}
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

function getReviewStatus(status: ReviewAssignmentStatus): ReviewStatus {
  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'pending') {
    return 'not-started';
  }

  return 'in-progress';
}

function ReviewProposalPane({
  assignment,
  className,
}: {
  assignment?: ReviewAssignment;
  className?: string;
}) {
  if (!assignment) {
    return (
      <div className={cn('min-w-0 flex-1 px-12 py-8', className)}>
        <Header1 className="font-sans">No proposal selected</Header1>
      </div>
    );
  }

  const proposal = assignment.proposal;
  const { title, budget, category } = resolveProposalSystemFields(proposal);
  const legacyHtml = proposal.htmlContent?.default;

  return (
    <div className={cn('min-w-0 flex-1 overflow-y-auto', className)}>
      <ProposalViewContent
        isDraft={proposal.status === 'draft'}
        title={title}
        category={category}
        budget={budget}
        submittedBy={proposal.submittedBy}
        createdAt={proposal.createdAt}
        likesCount={proposal.likesCount}
        commentsCount={proposal.commentsCount}
        followersCount={proposal.followersCount}
        legacyHtml={legacyHtml}
        resolvedHtmlContent={proposal.htmlContent}
        proposalTemplate={
          proposal.proposalTemplate as ProposalTemplateSchema | null
        }
        translatedMeta={null}
        attachments={proposal.attachments}
      />
    </div>
  );
}

function ReviewRubricPane({
  rubricTemplate,
  className,
}: {
  rubricTemplate?: RubricTemplateSchema | null;
  className?: string;
}) {
  if (!rubricTemplate) {
    return <div className={cn('min-w-0 flex-1', className)} />;
  }

  return (
    <div className={cn('min-w-0 flex-1 overflow-y-auto', className)}>
      <ReviewRubricForm template={rubricTemplate} />
    </div>
  );
}
