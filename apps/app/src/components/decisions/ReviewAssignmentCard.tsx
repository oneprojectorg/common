'use client';

import { type DecisionAccess } from '@op/api/encoders';
import {
  type ProposalReviewAggregates,
  type ReviewAssignmentExtended,
} from '@op/common/client';
import { ProposalCard as SenseProposalCard } from '@op/sense/ProposalCard';
import { StatusBadge } from '@op/sense/StatusBadge';
import { LuRefreshCw } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { useProposalCardData } from './ProposalCard';
import { ProposalReviewsCount } from './ProposalReviewsCount';
import { ReviewStatusBadge } from './ReviewStatusBadge';

type Reviewers = ProposalReviewAggregates['reviewers'];

interface ReviewAssignmentCardProps {
  assignment: ReviewAssignmentExtended;
  viewHref?: string;
  reviewers?: Reviewers;
  /** Review summary route for the assignment's proposal. */
  reviewsHref: string;
  access?: DecisionAccess;
  /** Whether to show the proposal's category tag (see ReviewAssignmentsList). */
  showCategory?: boolean;
  /** Forwarded to the card — carries the map view's active-pin highlight. */
  className?: string;
}

export function ReviewAssignmentCard({
  assignment: { assignment, isReviewOutOfDate },
  viewHref,
  reviewers,
  reviewsHref,
  access,
  showCategory = true,
  className,
}: ReviewAssignmentCardProps) {
  const t = useTranslations();
  const { proposal, status } = assignment;
  const isRevised = status === 'ready_for_re_review';
  // `ready_for_re_review` already tells the reviewer to look again, and says it
  // louder — its treatment wins, so the staleness pill stands down.
  const showOutOfDate = isReviewOutOfDate && !isRevised;
  const { titleText, budgetText, displayCategories, authors, description } =
    useProposalCardData(proposal);

  return (
    <SenseProposalCard
      className={className}
      title={titleText}
      href={viewHref}
      linkComponent={Link}
      budget={budgetText}
      authors={authors}
      tags={
        showCategory && displayCategories.length > 0
          ? displayCategories
          : undefined
      }
      description={description}
      alert={
        isRevised ? (
          <StatusBadge variant="revision" icon={LuRefreshCw}>
            {t('Revised')}
          </StatusBadge>
        ) : undefined
      }
      status={
        showOutOfDate ? (
          <StatusBadge variant="warning" icon={LuRefreshCw}>
            {t('Review out of date')}
          </StatusBadge>
        ) : (
          <ReviewStatusBadge status={status} />
        )
      }
      reviewedLabel={
        reviewers ? (
          <ProposalReviewsCount
            reviewers={reviewers}
            href={reviewsHref}
            access={access}
          />
        ) : undefined
      }
    />
  );
}
