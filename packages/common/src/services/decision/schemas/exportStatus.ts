import { z } from 'zod';

/**
 * Zod object schema for the cached record of one proposal export.
 *
 * Redis holds the only copy of this record. No table stands behind it, so this
 * schema is the sole description of the shape, and the sole check on it.
 * `getExportStatus` parses every cache read against it, and reports a record
 * that fails as `not_found`.
 *
 * `exportProposals` seeds the record in full, so the required fields are present
 * from the first write. The workflow then patches it, and each patch merges over
 * the record it reads.
 *
 * The optional fields arrive later, or never. The workflow writes `fileName`,
 * `signedUrl`, `urlExpiresAt`, `completedAt`, and the `rowCount` / `total` /
 * `truncated` counts when a run completes, and `errorMessage` when one fails.
 * `getExportStatus` also clears `signedUrl` when it cannot re-sign a lapsed URL.
 *
 * The counts must be listed here to survive a read: this schema is not strict,
 * so a field it does not name is stripped from every parsed record, and the
 * truncation notice would never reach the admin.
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
  /** Rows written to the file. Set once the export completes. */
  rowCount: z.number().optional(),
  /** Rows the instance held when the read started. Set once it completes. */
  total: z.number().optional(),
  /**
   * True when the row ceiling ended the read early, so `rowCount` is short of
   * `total`. Optional because records written before this field existed, and
   * records for runs still in flight, do not carry it — absent means "not
   * known to be truncated", which is the safe reading for a run that has not
   * finished.
   */
  truncated: z.boolean().optional(),
});

/**
 * The parsed export record, inferred from {@link exportStatusRecordSchema}.
 *
 * `z.infer` derives this type instead of a hand-written interface, so the type
 * and the check that produces it cannot drift. `getExportStatus` returns this
 * shape for a record it read and parsed, and `getExportStatus.ts` re-exports the
 * type for callers that already look there.
 */
export type ExportStatusData = z.infer<typeof exportStatusRecordSchema>;

/**
 * Zod union schema for everything `getExportStatus` answers: one parsed record,
 * or the not-found arm.
 *
 * The tRPC procedure in `services/api` uses this as its `.output()` schema, so
 * one definition describes both the service return type and the wire contract.
 * That router hand-rolled the same eleven fields before, which was a second copy
 * of this shape to keep in step by hand.
 *
 * `status` discriminates the two arms. `'not_found'` is not a member of
 * {@link exportStatusRecordSchema}'s `status` enum, so a caller that matches a
 * record status narrows the not-found arm away with no further check.
 */
export const exportStatusResponseSchema = z.union([
  z.object({ status: z.literal('not_found') }),
  exportStatusRecordSchema,
]);

/**
 * A parsed record or the not-found arm, inferred from
 * {@link exportStatusResponseSchema}.
 *
 * This is what the tRPC query hands a client. Narrow it on `status` before
 * reading any record field.
 */
export type ExportStatusResponse = z.infer<typeof exportStatusResponseSchema>;
