'use client';

import { trpc } from '@op/api/client';
import { PAGE_LIMIT } from '@op/common/client';
import { Tabs, TabsContent } from '@op/sense/Tabs';

import { useTranslations } from '@/lib/i18n';

import { ContributingIdeas } from '../ContributingIdeas';
import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalCommentsSection } from '../Proposal/ProposalCommentsSection';
import { ProposalTabList, ProposalTabTrigger } from '../Proposal/ProposalTabs';
import { useProposal } from '../Proposal/proposalContext';
import { useCommentsAllowed } from '../useCommentsAllowed';
import { ProposalReviewProgress } from './ProposalReviewProgress';
import { ProposalSheetShell } from './ProposalSheetShell';

/**
 * The proposal sheet for the admin review-progress screens. The viewer is an
 * admin (the routes that mount it are admin-gated by their loaders), and
 * `phaseId` is the phase the screen describes.
 */
export function ReviewProgressProposalSheet({ phaseId }: { phaseId: string }) {
  return (
    <ProposalSheetShell>
      <ProposalBody>
        <ContributingIdeas />
        <ReviewProgressSections phaseId={phaseId} />
      </ProposalBody>
    </ProposalSheetShell>
  );
}

function ReviewProgressSections({ phaseId }: { phaseId: string }) {
  const t = useTranslations();
  const { proposal } = useProposal();
  const commentsAllowed = useCommentsAllowed(proposal.processInstanceId);

  return (
    <Tabs defaultValue="reviews" className="gap-4">
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
