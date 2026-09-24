import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import { paginated, total } from '../../../utils/pagination';
import { proposalDataSchema } from '../proposalDataSchema';
import { eligibleReviewerSchema, reviewAssignmentListSchema } from './reviews';

export const phaseReviewerSummarySchema = z.object({
  reviewer: eligibleReviewerSchema,
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
});

export type PhaseReviewerSummary = z.infer<typeof phaseReviewerSummarySchema>;

export const phaseReviewerSummariesSchema = paginated(
  phaseReviewerSummarySchema,
).extend({
  /** Phase-wide counts, independent of the page. */
  totalReviewers: total,
  totalAssignments: total,
});

export type PhaseReviewerSummaries = z.infer<
  typeof phaseReviewerSummariesSchema
>;

export const reviewerQueueStatusSchema = z.union([
  z.enum(ProposalReviewAssignmentStatus),
  z.enum(ProposalReviewState),
]);

export type ReviewerQueueStatus = z.infer<typeof reviewerQueueStatusSchema>;

export const reviewerAssignmentsSchema = reviewAssignmentListSchema.extend({
  /** Null when the profile has no tie to this process. */
  reviewer: eligibleReviewerSchema.nullable(),
  /** False once the reviewer lost the REVIEW capability; their history stays visible. */
  isEligible: z.boolean(),
  /**
   * True only for the instance's current phase, which is what removal asserts.
   * A per-request fact, not a per-row one.
   */
  canModifyAssignments: z.boolean(),
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
  statusBreakdown: z.array(
    z.object({ status: reviewerQueueStatusSchema, count: z.number().int() }),
  ),
});

export type ReviewerAssignments = z.infer<typeof reviewerAssignmentsSchema>;

// ── Assignable proposals (the manage-assignments pick list) ───────────

/**
 * One proposal a reviewer could be assigned. `proposalData` is the stored
 * snapshot (the categories come from it); the title comes from `profileName`.
 */
export const assignableProposalSchema = z.object({
  id: z.uuid(),
  /** Card translations are keyed on the proposal's own profile. */
  profileId: z.uuid(),
  proposalData: proposalDataSchema,
  /** The proposal profile's name: the editor's autosave keeps it current. */
  profileName: z.string().nullable(),
  authorName: z.string().nullable(),
  /** The reviewer's assignment for this phase, or null when unassigned. */
  assignment: z
    .object({
      id: z.uuid(),
      status: z.enum(ProposalReviewAssignmentStatus),
      /** The review row's state, once the reviewer has started one. */
      reviewState: z.enum(ProposalReviewState).nullable(),
    })
    .nullable(),
  /** The reviewer submitted it, so the write would refuse to assign it. */
  isOwn: z.boolean(),
});

export type AssignableProposal = z.infer<typeof assignableProposalSchema>;

export const assignableProposalListSchema = paginated(assignableProposalSchema);

export type AssignableProposalList = z.infer<
  typeof assignableProposalListSchema
>;
