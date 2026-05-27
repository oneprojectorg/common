import { z } from 'zod';

export const attachmentSummarySchema = z.object({
  storageObjectId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nullable(),
});

const resourceBaseShape = {
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  addedByProfileUserId: z.string().uuid().nullable(),
  // Drizzle returns ISO strings (`mode: 'string'`). Not `z.coerce.date()` —
  // tRPC skips `.output()` validation in prod, so the client gets the raw
  // string and `.toISOString()` would blow up.
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  signedUrl: z.string().nullable(),
};

const linkResourceSchema = z.object({
  ...resourceBaseShape,
  type: z.literal('link'),
  linkUrl: z.string(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceSchema = z.object({
  ...resourceBaseShape,
  type: z.literal('document'),
  linkUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummarySchema,
});

export const resourceSchema = z.discriminatedUnion('type', [
  linkResourceSchema,
  documentResourceSchema,
]);

const inCollectionFields = {
  collectionId: z.string().uuid(),
  sortOrder: z.number(),
};

const linkResourceInCollectionSchema = z.object({
  ...resourceBaseShape,
  ...inCollectionFields,
  type: z.literal('link'),
  linkUrl: z.string(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceInCollectionSchema = z.object({
  ...resourceBaseShape,
  ...inCollectionFields,
  type: z.literal('document'),
  linkUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummarySchema,
});

export const resourceInCollectionSchema = z.discriminatedUnion('type', [
  linkResourceInCollectionSchema,
  documentResourceInCollectionSchema,
]);

export const resourceListResultSchema = z.object({
  collectionId: z.string().uuid().nullable(),
  resources: z.array(resourceInCollectionSchema),
});

export const collectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number(),
  addedByProfileUserId: z.string().uuid().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type AttachmentSummary = z.infer<typeof attachmentSummarySchema>;
export type ResourceDTO = z.infer<typeof resourceSchema>;
export type ResourceInCollectionDTO = z.infer<
  typeof resourceInCollectionSchema
>;
export type ResourceListResult = z.infer<typeof resourceListResultSchema>;
