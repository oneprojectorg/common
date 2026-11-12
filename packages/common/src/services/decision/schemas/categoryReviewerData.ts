import { z } from 'zod';

/** The `data` column of `decision_category_reviewers`. Each new key is a change here. */
export const categoryReviewerDataSchema = z
  .object({ developConfirmedAt: z.string().datetime().optional() })
  .strict();

export type CategoryReviewerData = z.infer<typeof categoryReviewerDataSchema>;
