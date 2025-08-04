import { z } from 'zod';

export const attachmentsEncoder = z.object({
  id: z.string(),
  postId: z.string(),
  storageObjectId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nullable(),
  uploadedBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Attachment = z.infer<typeof attachmentsEncoder>;

export const attachmentWithUrlEncoder = attachmentsEncoder.extend({
  url: z.string().optional(), // Signed URL for accessing the file
});

export type AttachmentWithUrl = z.infer<typeof attachmentWithUrlEncoder>;
