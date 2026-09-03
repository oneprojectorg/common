import { z } from 'zod';

import { eligibleReviewerSchema } from './reviews';

// ── Reviewers table (per-reviewer progress, no assignment rows) ────────

/**
 * One row of the phase reviewers table. `reviewer` reuses the eligible-reviewer
 * shape the review endpoints already speak, so the table and the reviewer
 * pickers stay one profile reference rather than two that drift apart.
 */
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
  /** Opaque keyset cursor for the next page; null on the last one. */
  next: z.string().nullable(),
  /**
   * Phase-wide, not page-wide: the live "N reviewers" label and the workload
   * total have to stay put while the table pages in more rows.
   */
  totalReviewers: z.number(),
  totalAssignments: z.number(),
});

export type PhaseReviewerSummaries = z.infer<
  typeof phaseReviewerSummariesSchema
>;
