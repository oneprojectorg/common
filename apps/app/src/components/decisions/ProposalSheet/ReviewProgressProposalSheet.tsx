'use client';

import { trpc } from '@op/api/client';
import { PAGE_LIMIT } from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import { useCommentsAllowed } from '../useCommentsAllowed';
import { ProposalReviewProgress } from './ProposalReviewProgress';
import { ProposalSheetBody } from './ProposalSheetBody';
import { ProposalSheetComments } from './ProposalSheetComments';
import { ProposalSheetShell } from './ProposalSheetShell';
import {
  ProposalSheetTabList,
  ProposalSheetTabPanel,
  ProposalSheetTabTrigger,
  ProposalSheetTabs,
} from './ProposalSheetTabs';
import { useSheetProposal } from './useSheetProposal';

/**
 * The proposal sheet for the admin review-progress screens. The viewer is an
 * admin (the routes that mount it are admin-gated by their loaders), and
 * `phaseId` is the phase the screen describes.
 */
export function ReviewProgressProposalSheet({ phaseId }: { phaseId: string }) {
  return (
    <ProposalSheetShell>
      <ProposalSheetBody>
        <ReviewProgressSections phaseId={phaseId} />
      </ProposalSheetBody>
    </ProposalSheetShell>
  );
}

function ReviewProgressSections({ phaseId }: { phaseId: string }) {
  const t = useTranslations();
  const { proposal } = useSheetProposal();
  const commentsAllowed = useCommentsAllowed(proposal.processInstanceId);

  return (
    <ProposalSheetTabs defaultValue="reviews" className="gap-4">
      <ProposalSheetTabList
        aria-label={t('decisions.proposals.sheetSectionsLabel')}
      >
        <ProposalSheetTabTrigger
          value="reviews"
          count={<ReviewsTabCount phaseId={phaseId} />}
        >
          {t('decisions.review.reviewsTab')}
        </ProposalSheetTabTrigger>
        {commentsAllowed ? (
          <ProposalSheetTabTrigger
            value="comments"
            count={<CommentsTabCount />}
          >
            {t('decisions.proposals.commentsHeading')}
          </ProposalSheetTabTrigger>
        ) : null}
      </ProposalSheetTabList>

      <ProposalSheetTabPanel value="reviews">
        <ProposalReviewProgress phaseId={phaseId} />
      </ProposalSheetTabPanel>
      {/* Kept mounted so a half-typed comment survives a tab switch. */}
      {commentsAllowed ? (
        <ProposalSheetTabPanel value="comments" keepMounted>
          <ProposalSheetComments hideHeading />
        </ProposalSheetTabPanel>
      ) : null}
    </ProposalSheetTabs>
  );
}

/** Not suspense, so the trigger never suspends; the panel's input, so one request. */
function ReviewsTabCount({ phaseId }: { phaseId: string }) {
  const { proposal } = useSheetProposal();
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
  const { proposal } = useSheetProposal();
  const { data } = trpc.posts.listProposalComments.useQuery({
    profileId: proposal.profileId,
    limit: PAGE_LIMIT.lg,
  });

  return data ? data.items.length : null;
}
