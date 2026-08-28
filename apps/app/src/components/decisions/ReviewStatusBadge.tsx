'use client';

import { type ProposalReviewAssignment } from '@op/common/client';
import { StatusBadge } from '@op/sense/StatusBadge';

import { TranslatedText } from '@/components/TranslatedText';

import { reviewStatusBadgeSpecs } from './reviewStatusBadgeSpecs';

type AssignmentStatus = ProposalReviewAssignment['status'];

/**
 * Status badge for one reviewer's assignment — Not Started / In Progress /
 * Completed / Revision Requested / Needs Review. Shared so every surface that
 * shows an assignment describes it the same way.
 */
export function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
  const { variant, icon, label } = reviewStatusBadgeSpecs[status];

  return (
    <StatusBadge variant={variant} icon={icon}>
      <TranslatedText text={label} />
    </StatusBadge>
  );
}
