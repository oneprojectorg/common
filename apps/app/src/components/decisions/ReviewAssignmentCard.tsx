'use client';

import {
  ProposalReviewAssignmentStatus,
  type ProposalReviewAggregates,
  type ProposalReviewAssignment,
  type ReviewAssignmentExtended,
} from '@op/common/client';
import { ProposalCard as SenseProposalCard } from '@op/sense/ProposalCard';
import { StatusBadge, type StatusBadgeProps } from '@op/sense/StatusBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
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

type AssignmentStatus = ProposalReviewAssignment['status'];

type Reviewers = ProposalReviewAggregates['reviewers'];

interface ReviewAssignmentCardProps {
  assignment: ReviewAssignmentExtended;
  viewHref?: string;
  reviewers?: Reviewers;
  /** Whether to show the proposal's category tag (see ReviewAssignmentsList). */
  showCategory?: boolean;
}

export function ReviewAssignmentCard({
  assignment: { assignment },
  viewHref,
  reviewers,
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
        reviewers ? <ReviewersTooltip reviewers={reviewers} /> : undefined
      }
    />
  );
}

function ReviewersTooltip({ reviewers }: { reviewers: Reviewers }) {
  const t = useTranslations();

  const completedReviewers = reviewers.filter(
    (r) => r.status === ProposalReviewAssignmentStatus.COMPLETED,
  );

  if (completedReviewers.length === 0) {
    return null;
  }

  const names = completedReviewers.map((r) => r.profile.name).join(', ');

  return (
    // The root layout provides the tooltip group and delay.
    <Tooltip>
      <TooltipTrigger
        render={
          // No aria-label: the visible "{count} Reviewed" text is the
          // accessible name; the tooltip popup (names) is exposed as the
          // description via base-ui's aria-describedby when open.
          <span
            tabIndex={0}
            className="cursor-help rounded-sm underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        {t('{count} Reviewed', { count: completedReviewers.length })}
      </TooltipTrigger>
      <TooltipContent className="text-sm">{names}</TooltipContent>
    </Tooltip>
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
