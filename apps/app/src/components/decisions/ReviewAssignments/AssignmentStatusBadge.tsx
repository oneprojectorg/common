'use client';

import type { AdminReviewAssignment } from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import type { StatusDotIntent } from '@op/sense/StatusDot';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

import { ReviewStatusBadge } from '../ReviewStatusBadge';

/** The merged status vocabulary: `reviewState ?? status` at every call site. */
export type AssignmentStatusValue =
  | AdminReviewAssignment['status']
  | NonNullable<AdminReviewAssignment['reviewState']>;

/**
 * The shared `ReviewStatusBadge` for the five statuses; the two review
 * states get the plain Badge treatment the rest of the codebase gives them.
 */
export function AssignmentStatusBadge({
  status,
}: {
  status: AssignmentStatusValue;
}) {
  const t = useTranslations();

  if (status === 'draft' || status === 'submitted') {
    return (
      <Badge variant={status === 'submitted' ? 'default' : 'warning'}>
        {t(assignmentStatusSpecs[status].label)}
      </Badge>
    );
  }

  return <ReviewStatusBadge status={status} />;
}

/** Label + StatusDot intent for the whole vocabulary — the progress rail's breakdown. */
export const assignmentStatusSpecs: Record<
  AssignmentStatusValue,
  { label: TranslationKey; intent: StatusDotIntent }
> = {
  pending: { label: 'Not Started', intent: 'neutral' },
  in_progress: { label: 'In Progress', intent: 'neutral' },
  completed: { label: 'Completed', intent: 'success' },
  awaiting_author_revision: {
    label: 'Revision Requested',
    intent: 'danger',
  },
  ready_for_re_review: { label: 'Needs Review', intent: 'warning' },
  draft: { label: 'Draft', intent: 'warning' },
  submitted: { label: 'Submitted', intent: 'success' },
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
