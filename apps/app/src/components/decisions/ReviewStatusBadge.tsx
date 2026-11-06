'use client';

import type { ProposalReviewAssignmentStatus } from '@op/common/client';
import { StatusBadge, type StatusBadgeProps } from '@op/sense/StatusBadge';
import type { IconType } from 'react-icons';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuPencilLine,
  LuRefreshCw,
  LuTimer,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

import type { AssignmentStatusValue } from './ReviewAssignments/assignmentStatusSpecs';

interface BadgeSpec {
  variant: StatusBadgeProps['variant'];
  icon: IconType;
  label: TranslationKey;
}

/**
 * A submitted review whose proposal changed since. `ready_for_re_review`
 * already tells the reviewer to look again, so it keeps its own badge.
 */
export function isReviewShownOutOfDate({
  isReviewOutOfDate,
  assignmentStatus,
}: {
  isReviewOutOfDate: boolean;
  assignmentStatus: ProposalReviewAssignmentStatus;
}): boolean {
  return isReviewOutOfDate && assignmentStatus !== 'ready_for_re_review';
}

/**
 * Status badge for one reviewer's assignment, covering the merged
 * `reviewState ?? status` vocabulary — the five assignment statuses plus the
 * admin-only Draft / Submitted review states. Shared so every surface that
 * shows an assignment describes it the same way.
 */
export function ReviewStatusBadge({
  status,
  isOutOfDate = false,
}: {
  status: AssignmentStatusValue;
  /** From `isReviewShownOutOfDate`; replaces the status with the out-of-date badge. */
  isOutOfDate?: boolean;
}) {
  const t = useTranslations();

  if (isOutOfDate) {
    return (
      <StatusBadge variant="warning" icon={LuRefreshCw}>
        {t('decisions.review.reviewOutOfDateLabel')}
      </StatusBadge>
    );
  }

  const { variant, icon, label } = assignmentBadges[status];

  return (
    <StatusBadge variant={variant} icon={icon}>
      {t(label)}
    </StatusBadge>
  );
}

const assignmentBadges: Record<AssignmentStatusValue, BadgeSpec> = {
  pending: {
    variant: 'inactive',
    icon: LuCircleDashed,
    label: 'decisions.review.statusNotStarted',
  },
  in_progress: {
    variant: 'in-progress',
    icon: LuTimer,
    label: 'decisions.review.statusInProgress',
  },
  completed: {
    variant: 'success',
    icon: LuCircleCheck,
    label: 'decisions.review.statusCompleted',
  },
  awaiting_author_revision: {
    variant: 'revision',
    icon: LuRefreshCw,
    label: 'decisions.review.statusRevisionRequested',
  },
  ready_for_re_review: {
    variant: 'warning',
    icon: LuCircleAlert,
    label: 'decisions.review.statusNeedsReview',
  },
  draft: {
    variant: 'warning',
    icon: LuPencilLine,
    label: 'decisions.draftStatus',
  },
  submitted: {
    variant: 'success',
    icon: LuCircleCheck,
    label: 'decisions.review.statusSubmitted',
  },
};
