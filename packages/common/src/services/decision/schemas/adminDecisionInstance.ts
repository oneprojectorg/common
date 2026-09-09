import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import { moneyAmountSchema } from '../../../money';
import { proposalCategorySchema } from './proposalCategory';

const adminDecisionCurrentPhaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  endDate: z.string().nullable(),
});

export const adminDecisionInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(ProcessStatus).nullable(),
  createdAt: z.string().nullable(),
  currentPhase: adminDecisionCurrentPhaseSchema.nullable(),
  stewardName: z.string().nullable(),
  proposalCount: z.number(),
  totalProposalCount: z.number(),
  participantCount: z.number(),
});

export type AdminDecisionInstance = z.infer<typeof adminDecisionInstanceSchema>;

// ── Instance detail (platform admin drill-down) ────────────────────────

/** Minimal profile reference rendered in admin tables and headers. */
export const adminProfileRefSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  slug: z.string().nullable(),
});

export type AdminProfileRef = z.infer<typeof adminProfileRefSchema>;

// ── Review assignments (per phase) ─────────────────────────────────────

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

/** Eligible reviewer candidate; `email` is the profile contact field. */
export const adminEligibleReviewerSchema = adminProfileRefSchema.extend({
  email: z.string().nullable(),
});

export type AdminEligibleReviewer = z.infer<typeof adminEligibleReviewerSchema>;

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
