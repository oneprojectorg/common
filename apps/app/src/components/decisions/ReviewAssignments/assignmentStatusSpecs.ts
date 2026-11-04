import type { AdminReviewAssignment } from '@op/common/client';

/** The merged status vocabulary: `reviewState ?? status` at every call site. */
export type AssignmentStatusValue =
  | AdminReviewAssignment['status']
  | NonNullable<AdminReviewAssignment['reviewState']>;
