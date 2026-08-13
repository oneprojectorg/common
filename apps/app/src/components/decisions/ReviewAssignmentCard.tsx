'use client';

import { type DecisionAccess } from '@op/api/encoders';
import {
  type ProposalReviewAggregates,
  type ProposalReviewAssignment,
  type ReviewAssignmentExtended,
} from '@op/common/client';
import { ProposalCard as SenseProposalCard } from '@op/sense/ProposalCard';
import { StatusBadge, type StatusBadgeProps } from '@op/sense/StatusBadge';
import type { IconType } from 'react-icons';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuRefreshCw,
  LuTimer,
} from 'react-icons/lu';

import type { TranslationKey } from '@/lib/i18n';
import { Link, useTranslations } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import { useProposalCardData } from './ProposalCard';
import { ProposalReviewsCount } from './ProposalReviewsCount';

type AssignmentStatus = ProposalReviewAssignment['status'];

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
}

export function ReviewAssignmentCard({
  assignment: { assignment },
  viewHref,
  reviewers,
  reviewsHref,
  access,
  showCategory = true,
}: ReviewAssignmentCardProps) {
  const t = useTranslations();
  const { proposal, status } = assignment;
  const isRevised = status === 'ready_for_re_review';
  const { titleText, budgetText, displayCategories, authors, description } =
    useProposalCardData(proposal);

  return (
    <SenseProposalCard
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
      status={<ReviewStatusBadge status={status} />}
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

const statusBadge: Record<
  AssignmentStatus,
  { variant: StatusBadgeProps['variant']; icon: IconType }
> = {
  pending: { variant: 'inactive', icon: LuCircleDashed },
  in_progress: { variant: 'in-progress', icon: LuTimer },
  completed: { variant: 'success', icon: LuCircleCheck },
  awaiting_author_revision: { variant: 'revision', icon: LuRefreshCw },
  ready_for_re_review: { variant: 'warning', icon: LuCircleAlert },
};

const statusLabels: Record<AssignmentStatus, TranslationKey> = {
  pending: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  awaiting_author_revision: 'Revision Requested',
  ready_for_re_review: 'Needs Review',
};

function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
  const { variant, icon } = statusBadge[status];

  return (
    <StatusBadge variant={variant} icon={icon}>
      <TranslatedText text={statusLabels[status]} />
    </StatusBadge>
  );
}
