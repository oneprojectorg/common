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
  createdAt: z.string(),
  completedAt: z.string().optional(),
  truncatedSections: z.array(personalDataExportSectionSchema).optional(),
});

export type PersonalDataExportStatusData = z.infer<
  typeof personalDataExportRecordSchema
>;

// The URL is signed on each read and never stored.
const personalDataExportReadSchema = personalDataExportRecordSchema.extend({
  signedUrl: z.string().optional(),
});

export type PersonalDataExportRead = z.infer<
  typeof personalDataExportReadSchema
>;

export const personalDataExportResponseSchema = z.union([
  z.object({ status: z.literal('not_found') }),
  personalDataExportReadSchema,
]);
