import { z } from 'zod';

/**
 * The cached record for one proposal export.
 *
 * Redis holds the only copy of this record. No table stands behind it, so this
 * schema is the sole description of the shape, and the sole check on it.
 *
 * `exportProposals` seeds the record in full. The workflow then patches it, and
 * each patch merges over the record it reads. Every field below is therefore
 * present from the first write, except the ones marked optional.
 */
export const exportStatusRecordSchema = z.object({
  exportId: z.string(),
  processInstanceId: z.string(),
  userId: z.string(),
  format: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  fileName: z.string().optional(),
  signedUrl: z.string().optional(),
  urlExpiresAt: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export type ExportStatusData = z.infer<typeof exportStatusRecordSchema>;

/**
 * What `getExportStatus` answers.
 *
 * `not_found` carries no other field, and `status` discriminates the two arms.
 * `'not_found'` is not a member of {@link exportStatusRecordSchema}'s `status`,
 * so a caller that matches a record status narrows away the not-found arm.
 */
export const exportStatusResponseSchema = z.union([
  z.object({ status: z.literal('not_found') }),
  exportStatusRecordSchema,
]);

export type ExportStatusResponse = z.infer<typeof exportStatusResponseSchema>;
