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
   * False once the phase is no longer the instance's current one: removal
   * asserts the same thing (`assertReviewAssignmentPhaseIsCurrent`), so a
   * pending row in a past phase is frozen, not removable. A per-request fact,
   * not a per-row one — the phase is the same for every row on the page.
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
 * One proposal a reviewer could be assigned, with the state that decides how
 * the row behaves. `assignment` is the reviewer's existing row for this phase,
 * so "already assigned" is a fact from the query rather than a set the client
 * assembled from however many queue pages it happened to hold.
 *
 * A narrow projection, not the full list row: the pick list shows a title, an
 * author and category chips. `proposalData` carries the same fragment-resolved
 * system fields the proposal list ships, so the chips can't disagree with the
 * rest of the app.
 */
export const assignableProposalSchema = z.object({
  id: z.uuid(),
  /** The proposal's own profile — what a card translation is keyed on. */
  profileId: z.uuid(),
  proposalData: proposalDataSchema,
  /** The proposal profile's name: the live title, and the title fallback. */
  profileName: z.string().nullable(),
  author: z
    .object({
      name: z.string().nullable(),
      slug: z.string().nullable(),
      isAnonymous: z.boolean(),
    })
    .nullable(),
  /** This reviewer's assignment for the phase, `null` when there is none. */
  assignment: z
    .object({
      id: z.uuid(),
      status: z.enum(ProposalReviewAssignmentStatus),
    })
    .nullable(),
  /** The reviewer submitted this proposal: never assignable to them. */
  isOwn: z.boolean(),
});

export type AssignableProposal = z.infer<typeof assignableProposalSchema>;

export const assignableProposalListSchema = paginated(assignableProposalSchema);

export type AssignableProposalList = z.infer<
  typeof assignableProposalListSchema
>;
