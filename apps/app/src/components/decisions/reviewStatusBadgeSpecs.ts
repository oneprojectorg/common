import type { ProposalReviewAssignment } from '@op/common/client';
import type { StatusBadgeProps } from '@op/sense/StatusBadge';
import type { IconType } from 'react-icons';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuRefreshCw,
  LuTimer,
} from 'react-icons/lu';

import type { TranslationKey } from '@/lib/i18n';

export type ReviewAssignmentStatus = ProposalReviewAssignment['status'];

export interface ReviewStatusBadgeSpec {
  variant: StatusBadgeProps['variant'];
  icon: IconType;
  label: TranslationKey;
}

/**
 * The one vocabulary for assignment-status badges, so every surface that
 * shows an assignment describes it the same way.
 */
export const reviewStatusBadgeSpecs: Record<
  ReviewAssignmentStatus,
  ReviewStatusBadgeSpec
> = {
  pending: {
    variant: 'inactive',
    icon: LuCircleDashed,
    label: 'Not Started',
  },
  in_progress: { variant: 'in-progress', icon: LuTimer, label: 'In Progress' },
  completed: { variant: 'success', icon: LuCircleCheck, label: 'Completed' },
  awaiting_author_revision: {
    variant: 'revision',
    icon: LuRefreshCw,
    label: 'Revision Requested',
  },
  ready_for_re_review: {
    variant: 'warning',
    icon: LuCircleAlert,
    label: 'Needs Review',
  },
};
