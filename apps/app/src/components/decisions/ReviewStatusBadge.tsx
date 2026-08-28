'use client';

import { type ProposalReviewAssignment } from '@op/common/client';
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

import { TranslatedText } from '@/components/TranslatedText';

type AssignmentStatus = ProposalReviewAssignment['status'];

interface BadgeSpec {
  variant: StatusBadgeProps['variant'];
  icon: IconType;
  label: TranslationKey;
}

/**
 * Status badge for one reviewer's assignment — Not Started / In Progress /
 * Completed / Revision Requested / Needs Review. Shared so every surface that
 * shows an assignment describes it the same way.
 */
export function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
  const { variant, icon, label } = assignmentBadges[status];

  return (
    <StatusBadge variant={variant} icon={icon}>
      <TranslatedText text={label} />
    </StatusBadge>
  );
}

const assignmentBadges: Record<AssignmentStatus, BadgeSpec> = {
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
