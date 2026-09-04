'use client';

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

import type { TranslationKey } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

import type { AssignmentStatusValue } from './ReviewAssignments/assignmentStatusSpecs';

interface BadgeSpec {
  variant: StatusBadgeProps['variant'];
  icon: IconType;
  label: TranslationKey;
}

/**
 * Status badge for one reviewer's assignment, covering the merged
 * `reviewState ?? status` vocabulary — the five assignment statuses plus the
 * admin-only Draft / Submitted review states. Shared so every surface that
 * shows an assignment describes it the same way.
 */
export function ReviewStatusBadge({
  status,
}: {
  status: AssignmentStatusValue;
}) {
  const { variant, icon, label } = assignmentBadges[status];

  return (
    <StatusBadge variant={variant} icon={icon}>
      <TranslatedText text={label} />
    </StatusBadge>
  );
}

const assignmentBadges: Record<AssignmentStatusValue, BadgeSpec> = {
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
  draft: { variant: 'warning', icon: LuPencilLine, label: 'Draft' },
  submitted: { variant: 'success', icon: LuCircleCheck, label: 'Submitted' },
};
