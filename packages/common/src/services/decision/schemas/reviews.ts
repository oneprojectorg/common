import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import { proposalSchema } from './proposal';

const jsonObjectSchema = z.record(z.string(), z.unknown());

// ── Review assignment schemas ───────────────────────────────────────────

export const proposalReviewAssignmentListItemSchema = z.object({
  id: z.uuid(),
  processInstanceId: z.uuid(),
  phaseId: z.string(),
  status: z.nativeEnum(ProposalReviewAssignmentStatus),
  proposal: proposalSchema,
});

export const proposalReviewAssignmentListSchema = z.object({
  assignments: z.array(proposalReviewAssignmentListItemSchema),
  total: z.number(),
  completed: z.number(),
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

export const reviewAssignmentDetailSchema = z.object({
  assignment: proposalReviewAssignmentListItemSchema,
  rubricTemplate: jsonObjectSchema.nullable(),
  review: proposalReviewSchema.nullable(),
});

// ── Types ───────────────────────────────────────────────────────────────

export type ProposalReviewAssignmentListItem = z.infer<
  typeof proposalReviewAssignmentListItemSchema
>;
export type ListProposalReviewAssignmentsResult = z.infer<
  typeof proposalReviewAssignmentListSchema
>;
export type ProposalReviewData = z.infer<typeof proposalReviewSchema>;
export type ProposalReview = z.infer<typeof proposalReviewSchema>;
export type ReviewAssignmentDetail = z.infer<
  typeof reviewAssignmentDetailSchema
>;
