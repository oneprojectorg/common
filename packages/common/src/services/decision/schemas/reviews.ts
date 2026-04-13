import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import type { RubricTemplateSchema } from '../types';
import { proposalSchema } from './proposal';

const jsonObjectSchema = z.record(z.string(), z.unknown());

const rubricTemplateSchema = jsonObjectSchema.transform(
  (data): RubricTemplateSchema => data as RubricTemplateSchema,
);

// ── Review assignment schemas ───────────────────────────────────────────

export const proposalReviewAssignmentSchema = z.object({
  id: z.uuid(),
  processInstanceId: z.uuid(),
  phaseId: z.string(),
  status: z.enum(ProposalReviewAssignmentStatus),
  proposal: proposalSchema,
});

// ── Revision request schemas ───────────────────────────────────────────

export const proposalReviewRequestSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  state: z.enum(ProposalReviewRequestState),
  requestComment: z.string(),
  requestedAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

// ── Review schemas ──────────────────────────────────────────────────────

export const proposalReviewSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  state: z.enum(ProposalReviewState),
  reviewData: jsonObjectSchema,
  overallComment: z.string().nullable(),
  submittedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const reviewAssignmentExtendedSchema = z.object({
  assignment: proposalReviewAssignmentSchema,
  rubricTemplate: rubricTemplateSchema.nullable(),
  review: proposalReviewSchema.nullable(),
  revisionRequest: proposalReviewRequestSchema.nullable(),
});

export const reviewAssignmentListSchema = z.object({
  assignments: z.array(reviewAssignmentExtendedSchema),
});

// ── Types ───────────────────────────────────────────────────────────────

export type ProposalReviewAssignment = z.infer<
  typeof proposalReviewAssignmentSchema
>;
export type ProposalReviewRequest = z.infer<typeof proposalReviewRequestSchema>;
export type ProposalReview = z.infer<typeof proposalReviewSchema>;
export type ReviewAssignmentExtended = z.infer<
  typeof reviewAssignmentExtendedSchema
>;
export type ReviewAssignmentList = z.infer<typeof reviewAssignmentListSchema>;
