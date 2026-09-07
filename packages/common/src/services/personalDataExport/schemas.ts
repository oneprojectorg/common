import { z } from 'zod';

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
 * The cached record of one personal data export. Redis holds the only copy, so
 * this schema is the sole check on its shape. The optional fields arrive when a
 * run completes or fails.
 */
export const personalDataExportRecordSchema = z.object({
  exportId: z.string(),
  /** Auth user id of the data subject, and the only permitted reader. */
  userId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  fileName: z.string().optional(),
  signedUrl: z.string().optional(),
  urlExpiresAt: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  /**
   * Sections the row ceiling cut short. Must be listed here to survive a read:
   * the schema is not strict, so an unnamed field is stripped and the subject
   * would never learn the file is short.
   */
  truncatedSections: z.array(personalDataExportSectionSchema).optional(),
});

export type PersonalDataExportStatusData = z.infer<
  typeof personalDataExportRecordSchema
>;

/** The tRPC `.output()` schema, so the wire contract and the service agree. */
export const personalDataExportResponseSchema = z.union([
  z.object({ status: z.literal('not_found') }),
  personalDataExportRecordSchema,
]);
