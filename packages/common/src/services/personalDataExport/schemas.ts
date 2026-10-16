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

export type PersonalDataExportSection = z.infer<
  typeof personalDataExportSectionSchema
>;

export const personalDataExportRecordSchema = z.object({
  exportId: z.string().uuid(),
  // UUID-only because the storage path is built from it.
  userId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  fileName: z.string().optional(),
  signedUrl: z.string().optional(),
  urlExpiresAt: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  truncatedSections: z.array(personalDataExportSectionSchema).optional(),
});

export type PersonalDataExportStatusData = z.infer<
  typeof personalDataExportRecordSchema
>;

export const personalDataExportResponseSchema = z.union([
  z.object({ status: z.literal('not_found') }),
  personalDataExportRecordSchema,
]);
