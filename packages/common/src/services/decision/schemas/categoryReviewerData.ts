import { z } from 'zod';

/**
 * The `data` column of `decision_category_reviewers`. Loose, not strict: the
 * column gains keys over time and the write path merges keys with `||`, so a
 * strict read would report a confirmed row as unconfirmed once a second key
 * exists.
 */
export const categoryReviewerDataSchema = z.looseObject({
  developConfirmedAt: z.iso.datetime().optional(),
});

export type CategoryReviewerData = z.infer<typeof categoryReviewerDataSchema>;
