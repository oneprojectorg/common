'use client';

import {
  type ProposalReviewAssignment,
  type ProposalReviewStatus,
} from '@op/common/client';
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
 * Status badge for one reviewer's assignment — the reviewer-facing vocabulary
 * (Not Started / In Progress / Completed / Revision Requested / Needs Review).
 */
export function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
  return <StatusBadgeFor spec={assignmentBadges[status]} />;
}

/**
 * Status badge for a proposal's review-progress rollup — the admin-facing
 * vocabulary. Deliberately three-way (see `PROPOSAL_REVIEW_STATUSES`): an admin
 * tracking progress asks "has anyone finished this one?", not "what is each
 * reviewer doing?". Shares the icon and accent of the assignment badge it
 * corresponds to so the two surfaces read as one system.
 */
export function ProposalReviewStatusBadge({
  status,
}: {
  status: ProposalReviewStatus;
}) {
  return <StatusBadgeFor spec={proposalBadges[status]} />;
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

const proposalBadges: Record<ProposalReviewStatus, BadgeSpec> = {
  not_started: {
    variant: 'inactive',
    icon: LuCircleDashed,
    label: 'Not Started',
  },
  in_progress: { variant: 'in-progress', icon: LuTimer, label: 'In Progress' },
  reviewed: { variant: 'success', icon: LuCircleCheck, label: 'Reviewed' },
};

const StatusBadgeFor = ({ spec }: { spec: BadgeSpec }) => (
  <StatusBadge variant={spec.variant} icon={spec.icon}>
    <TranslatedText text={spec.label} />
  </StatusBadge>
);
