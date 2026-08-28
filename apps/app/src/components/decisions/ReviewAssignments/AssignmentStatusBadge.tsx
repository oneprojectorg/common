'use client';

import type { AdminReviewAssignment } from '@op/common/client';
import { StatusBadge, type StatusBadgeProps } from '@op/sense/StatusBadge';
import type { StatusDotIntent } from '@op/sense/StatusDot';
import type { IconType } from 'react-icons';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuPencilLine,
  LuRefreshCw,
  LuSend,
  LuTimer,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

/** The merged status vocabulary: `reviewState ?? status` at every call site. */
export type AssignmentStatusValue =
  | AdminReviewAssignment['status']
  | NonNullable<AdminReviewAssignment['reviewState']>;

interface AssignmentStatusSpec {
  variant: StatusBadgeProps['variant'];
  icon: IconType;
  label: TranslationKey;
  intent: StatusDotIntent;
}

/** `ReviewStatusBadge`'s five specs plus the two review states. */
export function AssignmentStatusBadge({
  status,
}: {
  status: AssignmentStatusValue;
}) {
  const t = useTranslations();
  const { variant, icon, label } = assignmentStatusSpecs[status];

  return (
    <StatusBadge variant={variant} icon={icon}>
      {t(label)}
    </StatusBadge>
  );
}

export const assignmentStatusSpecs: Record<
  AssignmentStatusValue,
  AssignmentStatusSpec
> = {
  pending: {
    variant: 'inactive',
    icon: LuCircleDashed,
    label: 'Not Started',
    intent: 'neutral',
  },
  in_progress: {
    variant: 'in-progress',
    icon: LuTimer,
    label: 'In Progress',
    intent: 'neutral',
  },
  completed: {
    variant: 'success',
    icon: LuCircleCheck,
    label: 'Completed',
    intent: 'success',
  },
  awaiting_author_revision: {
    variant: 'revision',
    icon: LuRefreshCw,
    label: 'Revision Requested',
    intent: 'danger',
  },
  ready_for_re_review: {
    variant: 'warning',
    icon: LuCircleAlert,
    label: 'Needs Review',
    intent: 'warning',
  },
  draft: {
    variant: 'warning',
    icon: LuPencilLine,
    label: 'Draft',
    intent: 'warning',
  },
  submitted: {
    variant: 'success',
    icon: LuSend,
    label: 'Submitted',
    intent: 'success',
  },
};

// Breakdown reading order. A rank, not an array — the values are enum
// members a bare string literal can't stand in for.
export const assignmentStatusRank: Record<AssignmentStatusValue, number> = {
  submitted: 0,
  in_progress: 1,
  draft: 2,
  completed: 3,
  ready_for_re_review: 4,
  awaiting_author_revision: 5,
  pending: 6,
};
