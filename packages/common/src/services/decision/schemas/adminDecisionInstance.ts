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

/**
 * Phase summary with capability flags derived from `instanceData.phases[].rules`
 * (`hasProposals` = rules.proposals.submit, `hasReviews` = `isReviewPhase`
 * (rules.reviews.submit ?? rules.proposals.review), `hasVoting` = rules.voting.submit).
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
  canEditProposals: z.boolean(),
  canEditVotes: z.boolean(),
  /** Null = no limit. */
  maxVotesPerMember: z.number().nullable(),
  proposalsHiddenByDefault: z.boolean(),
  /** 'date' | 'manual' | null when unset. */
  advancementMethod: z.string().nullable(),
});

/** Process-level configuration toggles surfaced to platform admins. */
export const adminDecisionConfigSchema = z.object({
  isPrivate: z.boolean(),
  hideBudget: z.boolean(),
  hasProposalTemplate: z.boolean(),
  hasRubric: z.boolean(),
  reviewsAllowRevisions: z.boolean(),
  reviewsAnonymousFeedback: z.boolean(),
  requireCategorySelection: z.boolean(),
  allowMultipleCategories: z.boolean(),
  organizeByCategories: z.boolean(),
  requireCollaborativeProposals: z.boolean(),
  categoriesCount: z.number(),
});

export type AdminDecisionConfig = z.infer<typeof adminDecisionConfigSchema>;

export type AdminDecisionPhase = z.infer<typeof adminDecisionPhaseSchema>;

export const adminDecisionInstanceDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Slug of the decision's profile, used for the public decision URL. */
  slug: z.string().nullable(),
  status: z.enum(ProcessStatus).nullable(),
  createdAt: z.string().nullable(),
  owner: adminProfileRefSchema.nullable(),
  steward: adminProfileRefSchema.nullable(),
  reviewsPolicy: z.string().nullable(),
  /** Template/process the instance was created from. */
  processType: z.string().nullable(),
  templateVersion: z.string().nullable(),
  config: adminDecisionConfigSchema,
  /** Raw and unparsed - admins read shapes our schemas don't model. */
  instanceData: z.unknown(),
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

// ── Reviewers table (per-reviewer progress, no assignment rows) ────────

export const phaseReviewerSummarySchema = z.object({
  profile: adminProfileRefSchema,
  email: z.string().nullable(),
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

export const reviewerPoolAssignmentSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  status: z.enum(ProposalReviewAssignmentStatus),
  reviewState: z.enum(ProposalReviewState).nullable(),
});

export const reviewerAssignmentPoolSchema = z.object({
  reviewer: adminEligibleReviewerSchema,
  /** False once the reviewer lost the REVIEW capability; the queue freezes. */
  isEligible: z.boolean(),
  assignments: z.array(reviewerPoolAssignmentSchema),
  /** Proposals in the phase (per getProposalIdsForPhase). */
  proposals: z.array(adminAssignableProposalSchema),
});

export type ReviewerPoolAssignment = z.infer<
  typeof reviewerPoolAssignmentSchema
>;

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
  reviewer: adminEligibleReviewerSchema,
  /** False once the reviewer lost the REVIEW capability; history stays visible. */
  isEligible: z.boolean(),
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
  assignments: z.array(reviewerAssignmentCardSchema),
});

export type ReviewerAssignments = z.infer<typeof reviewerAssignmentsSchema>;
