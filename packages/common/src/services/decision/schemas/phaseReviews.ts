/**
 * The admin "reviews of this phase" read model: a page of reviews, the total
 * behind it, and a facet count per rubric choice option.
 */
import { proposalReviews } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import {
  templateFieldFacetSchema,
  templateFieldFiltersSchema,
} from './templateFieldFacets';

/** Which reviews the list covers. `submitted` is the default. */
export const PHASE_REVIEW_STATES = ['submitted', 'draft', 'all'] as const;

export type PhaseReviewStateFilter = (typeof PHASE_REVIEW_STATES)[number];

/** The shared answer-filter contract, named for this read's callers. */
export const phaseReviewFiltersSchema = templateFieldFiltersSchema;

export type PhaseReviewFilters = z.infer<typeof phaseReviewFiltersSchema>;

/**
 * One review row. Review columns come from the table; the rest is joined
 * context the caller would otherwise have to fetch per row.
 */
export const phaseReviewItemSchema = createSelectSchema(proposalReviews)
  .pick({
    assignmentId: true,
    submittedAt: true,
  })
  .extend({
    reviewId: z.uuid(),
    proposalId: z.uuid(),
    /** The proposal's profile name, falling back to the snapshot title. */
    proposalTitle: z.string().nullable(),
    reviewerProfileId: z.uuid(),
    reviewerName: z.string().nullable(),
    answers: z.record(z.string(), z.unknown()),
  });

export type PhaseReviewItem = z.infer<typeof phaseReviewItemSchema>;

/** The shared facet contract, named for this read's callers. */
export const phaseReviewFacetSchema = templateFieldFacetSchema;

export type PhaseReviewFacet = z.infer<typeof phaseReviewFacetSchema>;

export const phaseReviewListSchema = z.object({
  items: z.array(phaseReviewItemSchema),
  /** Rows matching every filter, not just the page. */
  total: z.number().int().nonnegative(),
  facets: z.array(phaseReviewFacetSchema),
  nextCursor: z.string().nullable(),
});

export type PhaseReviewList = z.infer<typeof phaseReviewListSchema>;
