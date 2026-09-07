import { z } from 'zod';

/**
 * The sections a personal data export file carries.
 *
 * Named here rather than inferred from the collected object so the set is a
 * declared contract: `truncatedSections` on the record is checked against it,
 * and a section added to the read without being added here fails the check
 * instead of travelling as an unrecognised string.
 */
const PERSONAL_DATA_EXPORT_SECTIONS = [
  'posts',
  'postReactions',
  'proposals',
  'attachments',
  'customFormSubmissions',
  'voteSubmissions',
] as const;

const personalDataExportSectionSchema = z.enum(PERSONAL_DATA_EXPORT_SECTIONS);

/** One collection in a personal data export file. */
export type PersonalDataExportSection = z.infer<
  typeof personalDataExportSectionSchema
>;

/**
 * Zod object schema for the cached record of one personal data export.
 *
 * Redis holds the only copy of this record. No table stands behind it, so this
 * schema is the sole description of the shape, and the sole check on it.
 * `getPersonalDataExportStatus` parses every cache read against it, and reports
 * a record that fails as `not_found`.
 *
 * `requestPersonalDataExport` seeds the record in full, so the required fields
 * are present from the first write. The workflow then patches it, and each patch
 * merges over the record it reads.
 *
 * The optional fields arrive later, or never. The workflow writes `fileName`,
 * `signedUrl`, `urlExpiresAt`, `completedAt`, and `truncatedSections` when a run
 * completes, and `errorMessage` when one fails.
 * `getPersonalDataExportStatus` also clears `signedUrl` when it cannot re-sign a
 * lapsed URL.
 *
 * `truncatedSections` must be listed here to survive a read: this schema is not
 * strict, so a field it does not name is stripped from every parsed record, and
 * the notice that the file is short would never reach the subject.
 */
export const personalDataExportRecordSchema = z.object({
  exportId: z.string(),
  /**
   * Auth user id of the data subject, who is also the only permitted reader.
   * `getPersonalDataExportStatus` compares this against the caller, and the
   * storage key is built from it.
   */
  userId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  fileName: z.string().optional(),
  signedUrl: z.string().optional(),
  urlExpiresAt: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  /**
   * Sections the row ceiling cut short, so the file holds fewer rows than the
   * subject has. Empty on a complete export. Optional because a run still in
   * flight has not written it — absent means "not known to be truncated", which
   * is the safe reading for a run that has not finished.
   */
  truncatedSections: z.array(personalDataExportSectionSchema).optional(),
});

/**
 * The parsed export record, inferred from
 * {@link personalDataExportRecordSchema}.
 *
 * `z.infer` derives this type instead of a hand-written interface, so the type
 * and the check that produces it cannot drift.
 */
export type PersonalDataExportStatusData = z.infer<
  typeof personalDataExportRecordSchema
>;

/**
 * Zod union schema for everything `getPersonalDataExportStatus` answers: one
 * parsed record, or the not-found arm.
 *
 * The tRPC procedure in `services/api` uses this as its `.output()` schema, so
 * one definition describes both the service return type and the wire contract.
 *
 * `status` discriminates the two arms. `'not_found'` is not a member of
 * {@link personalDataExportRecordSchema}'s `status` enum, so a caller that
 * matches a record status narrows the not-found arm away with no further check.
 */
export const personalDataExportResponseSchema = z.union([
  z.object({ status: z.literal('not_found') }),
  personalDataExportRecordSchema,
]);
