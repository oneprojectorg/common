'use client';

import { trpc } from '@op/api/client';
import { PAGE_LIMIT } from '@op/common/client';
import { Tabs, TabsContent } from '@op/sense/Tabs';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import { useTranslations } from '@/lib/i18n';

import { ContributingIdeas } from '../ContributingIdeas';
import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalCommentsSection } from '../Proposal/ProposalCommentsSection';
import { ProposalTabList, ProposalTabTrigger } from '../Proposal/ProposalTabs';
import { useProposal } from '../Proposal/proposalContext';
import { useCommentsAllowed } from '../useCommentsAllowed';
import { ProposalReviewProgress } from './ProposalReviewProgress';
import { ProposalSheetShell } from './ProposalSheetShell';

type SectionTab = 'reviews' | 'comments';

/**
 * The proposal sheet for the admin review-progress screens. The viewer is an
 * admin (the routes that mount it are admin-gated by their loaders), and
 * `phaseId` is the phase the screen describes.
 */
export function ReviewProgressProposalSheet({ phaseId }: { phaseId: string }) {
  return (
    <ProposalSheetShell>
      <ReviewProgressBody phaseId={phaseId} />
    </ProposalSheetShell>
  );
}

/** Inside the shell, so the open tab resets when the sheet shows another proposal. */
function ReviewProgressBody({ phaseId }: { phaseId: string }) {
  const [tab, setTab] = useState<SectionTab>('reviews');

  return (
    <ProposalBody
      // Show the panel before the link follows its anchor, so the anchor is visible.
      onCommentsLinkClick={() => flushSync(() => setTab('comments'))}
    >
      <ContributingIdeas />
      <ReviewProgressSections
        phaseId={phaseId}
        tab={tab}
        onTabChange={setTab}
      />
    </ProposalBody>
  );
}

function ReviewProgressSections({
  phaseId,
  tab,
  onTabChange,
}: {
  phaseId: string;
  tab: SectionTab;
  onTabChange: (tab: SectionTab) => void;
}) {
  const t = useTranslations();
  const { proposal } = useProposal();
  const commentsAllowed = useCommentsAllowed(proposal.processInstanceId);

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        // Tabs reports a plain value; only the two sections are real.
        if (next === 'reviews' || next === 'comments') {
          onTabChange(next);
        }
      }}
      className="gap-4"
    >
      <ProposalTabList aria-label={t('decisions.proposals.sheetSectionsLabel')}>
        <ProposalTabTrigger
          value="reviews"
          count={<ReviewsTabCount phaseId={phaseId} />}
        >
          {t('decisions.review.reviewsTab')}
        </ProposalTabTrigger>
        {commentsAllowed ? (
          <ProposalTabTrigger value="comments" count={<CommentsTabCount />}>
            {t('decisions.proposals.commentsHeading')}
          </ProposalTabTrigger>
        ) : null}
      </ProposalTabList>

      <TabsContent value="reviews">
        <ProposalReviewProgress phaseId={phaseId} />
      </TabsContent>
      {/* Kept mounted so a half-typed comment survives a tab switch. */}
      {commentsAllowed ? (
        <TabsContent value="comments" keepMounted>
          <ProposalCommentsSection hideHeading />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

/** Not suspense, so the trigger never suspends; the panel's input, so one request. */
function ReviewsTabCount({ phaseId }: { phaseId: string }) {
  const { proposal } = useProposal();
  const { data } = trpc.decision.getProposalWithReviewAggregates.useQuery({
    processInstanceId: proposal.processInstanceId,
    proposalId: proposal.id,
    phaseId,
  });

  if (!data) {
    return null;
  }

  const { reviewsSubmittedCount, assignmentsCount } = data.aggregates;

  return assignmentsCount > 0
    ? `${reviewsSubmittedCount}/${assignmentsCount}`
    : 0;
}

/** The input `ProposalComments` uses, so both read one cache entry. */
function CommentsTabCount() {
  const { proposal } = useProposal();
  const { data } = trpc.posts.listProposalComments.useQuery({
    profileId: proposal.profileId,
    limit: PAGE_LIMIT.lg,
  });

  // First page only: the procedure returns no total to count past it.
  return data ? data.items.length : null;
}
