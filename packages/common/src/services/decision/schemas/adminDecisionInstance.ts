import { ProcessStatus } from '@op/db/schema';
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
