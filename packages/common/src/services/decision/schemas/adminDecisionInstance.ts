import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

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
  instanceData: z.unknown(),
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

/**
 * Phase summary with capability flags derived from `instanceData.phases[].rules`
 * (`hasProposals` = rules.proposals.submit, `hasReviews` = rules.proposals.review,
 * `hasVoting` = rules.voting.submit).
 */
export const adminDecisionPhaseSchema = z.object({
  phaseId: z.string(),
  name: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
  hasProposals: z.boolean(),
  hasReviews: z.boolean(),
  hasVoting: z.boolean(),
});

export type AdminDecisionPhase = z.infer<typeof adminDecisionPhaseSchema>;

export const adminDecisionInstanceDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(ProcessStatus).nullable(),
  createdAt: z.string().nullable(),
  owner: adminProfileRefSchema.nullable(),
  steward: adminProfileRefSchema.nullable(),
  reviewsPolicy: z.string().nullable(),
  phases: z.array(adminDecisionPhaseSchema),
});

export type AdminDecisionInstanceDetail = z.infer<
  typeof adminDecisionInstanceDetailSchema
>;

// ── Review assignments (per phase) ─────────────────────────────────────

export const adminReviewAssignmentSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  proposalTitle: z.string().nullable(),
  status: z.enum(ProposalReviewAssignmentStatus),
  reviewState: z.enum(ProposalReviewState).nullable(),
  submittedAt: z.string().nullable(),
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
});

export type AdminAssignableProposal = z.infer<
  typeof adminAssignableProposalSchema
>;

export const adminDecisionReviewAssignmentsSchema = z.object({
  reviewers: z.array(adminDecisionReviewerSchema),
  totalAssignments: z.number(),
  /** Members eligible to review (REVIEW capability on the decisions zone). */
  eligibleReviewers: z.array(adminProfileRefSchema),
  /** Non-draft proposals of the process, candidates for manual assignment. */
  proposals: z.array(adminAssignableProposalSchema),
});

export type AdminDecisionReviewAssignments = z.infer<
  typeof adminDecisionReviewAssignmentsSchema
>;
