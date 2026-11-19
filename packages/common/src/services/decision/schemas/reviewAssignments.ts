import { z } from 'zod';

import { eligibleReviewerSchema } from './reviews';
import {
  templateFieldFacetsSchema,
  templateFieldFiltersSchema,
} from './templateFieldFacets';

/**
 * Rubric answer filters on the reviewer queue: criterion key to option ids,
 * ANY-OF within a key and AND across keys. Applied to the assignment's own
 * review, so an assignment with no review row matches no filter.
 */
export const reviewAssignmentFieldFiltersSchema = templateFieldFiltersSchema;

export type ReviewAssignmentFieldFilters = z.infer<
  typeof reviewAssignmentFieldFiltersSchema
>;

/** Output of `decision.listReviewAssignmentFieldFacets`. */
export const reviewAssignmentFieldFacetsSchema = templateFieldFacetsSchema;

export type ReviewAssignmentFieldFacets = z.infer<
  typeof reviewAssignmentFieldFacetsSchema
>;

export const phaseReviewerSummarySchema = z.object({
  reviewer: eligibleReviewerSchema,
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
});

export type PhaseReviewerSummary = z.infer<typeof phaseReviewerSummarySchema>;

export const phaseReviewerSummariesSchema = z.object({
  reviewers: z.array(phaseReviewerSummarySchema),
  next: z.string().nullable(),
  totalReviewers: z.number(),
  totalAssignments: z.number(),
});

export type PhaseReviewerSummaries = z.infer<
  typeof phaseReviewerSummariesSchema
>;
