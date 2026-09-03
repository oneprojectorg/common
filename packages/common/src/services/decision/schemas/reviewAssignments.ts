import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import { moneyAmountSchema } from '../../../money';
// The admin surfaces share one profile reference; it stays with the instance
// schemas so this file is the only edge between the two.
import { adminProfileRefSchema } from './adminDecisionInstance';
import { proposalCategorySchema } from './proposalCategory';

/** Eligible reviewer candidate; `email` is the profile contact field. */
export const adminEligibleReviewerSchema = adminProfileRefSchema.extend({
  email: z.string().nullable(),
});

export type AdminEligibleReviewer = z.infer<typeof adminEligibleReviewerSchema>;

export const adminReviewAssignmentSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  proposalTitle: z.string().nullable(),
  status: z.enum(ProposalReviewAssignmentStatus),
  reviewState: z.enum(ProposalReviewState).nullable(),
  submittedAt: z.string().nullable(),
  categories: z.array(proposalCategorySchema),
  author: adminProfileRefSchema.nullable(),
  /** Plain-text body preview, resolved like the proposal list rows'; null when there is nothing to preview. */
  previewText: z.string().nullable(),
  /** Budget from the document fragments, falling back to the proposalData snapshot. */
  budget: moneyAmountSchema.nullable(),
});

export type AdminReviewAssignment = z.infer<typeof adminReviewAssignmentSchema>;

export const adminDecisionReviewerSchema = z.object({
  profile: adminProfileRefSchema,
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
  assignments: z.array(adminReviewAssignmentSchema),
});

export type AdminDecisionReviewer = z.infer<typeof adminDecisionReviewerSchema>;

/** Proposal candidate for the manual-assignment dialog. */
export const adminAssignableProposalSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  submittedByProfileId: z.string().nullable(),
  author: adminProfileRefSchema.nullable(),
  categories: z.array(proposalCategorySchema),
});

export type AdminAssignableProposal = z.infer<
  typeof adminAssignableProposalSchema
>;

/** Full phase rollup — platform admin only; it expands and exports the rows. */
export const adminDecisionReviewAssignmentsSchema = z.object({
  reviewers: z.array(adminDecisionReviewerSchema),
  totalAssignments: z.number(),
  /** Members eligible to review (REVIEW capability on the decisions zone). */
  eligibleReviewers: z.array(adminEligibleReviewerSchema),
  /** Proposals in the phase (per getProposalIdsForPhase), candidates for manual assignment. */
  proposals: z.array(adminAssignableProposalSchema),
});

export type AdminDecisionReviewAssignments = z.infer<
  typeof adminDecisionReviewAssignmentsSchema
>;

// ── Reviewers table (per-reviewer progress, no assignment rows) ────────

export const phaseReviewerSummarySchema = z.object({
  reviewer: adminEligibleReviewerSchema,
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
});

export type PhaseReviewerSummary = z.infer<typeof phaseReviewerSummarySchema>;

export const phaseReviewerSummariesSchema = z.object({
  reviewers: z.array(phaseReviewerSummarySchema),
  totalAssignments: z.number(),
});

export type PhaseReviewerSummaries = z.infer<
  typeof phaseReviewerSummariesSchema
>;

// ── Manage-assignments dialog (one reviewer's pick list) ───────────────

/** The dialog only needs enough of an assignment to badge and unassign it. */
export const reviewerPoolAssignmentSchema = adminReviewAssignmentSchema.pick({
  id: true,
  proposalId: true,
  status: true,
  reviewState: true,
});

export type ReviewerPoolAssignment = z.infer<
  typeof reviewerPoolAssignmentSchema
>;

export const reviewerAssignmentPoolSchema = z.object({
  /** Null when the profile has no tie to this process — see getReviewerAssignmentPool. */
  reviewer: adminEligibleReviewerSchema.nullable(),
  /** False once the reviewer lost the REVIEW capability; the queue freezes. */
  isEligible: z.boolean(),
  assignments: z.array(reviewerPoolAssignmentSchema),
  /** Proposals in the phase (per getProposalIdsForPhase). */
  proposals: z.array(adminAssignableProposalSchema),
});

export type ReviewerAssignmentPool = z.infer<
  typeof reviewerAssignmentPoolSchema
>;

// ── One reviewer's queue (reviewer detail screen) ──────────────────────

export const reviewerAssignmentCardSchema = adminReviewAssignmentSchema.extend({
  /** Submitted reviews on this proposal across every reviewer, not just this one. */
  reviewedCount: z.number(),
});

export type ReviewerAssignmentCard = z.infer<
  typeof reviewerAssignmentCardSchema
>;

export const reviewerAssignmentsSchema = z.object({
  /** Null when the profile has no tie to this process — see getReviewerAssignments. */
  reviewer: adminEligibleReviewerSchema.nullable(),
  /** False once the reviewer lost the REVIEW capability; history stays visible. */
  isEligible: z.boolean(),
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
  assignments: z.array(reviewerAssignmentCardSchema),
});

export type ReviewerAssignments = z.infer<typeof reviewerAssignmentsSchema>;
