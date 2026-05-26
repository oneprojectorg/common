import { z } from 'zod';

export const attachmentSummaryEncoder = z.object({
  storageObjectId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nullable(),
});

const resourceBase = {
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  addedByProfileUserId: z.string().uuid().nullable(),
  // ISO string from Drizzle (`mode: 'string'`). Don't use `z.coerce.date()`
  // — tRPC skips `.output()` validation in production builds, so the string
  // would reach the client unchanged and `.toISOString()` on it blows up.
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  signedUrl: z.string().nullable(),
};

const linkResourceEncoder = z.object({
  ...resourceBase,
  type: z.literal('link'),
  linkUrl: z.string(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceEncoder = z.object({
  ...resourceBase,
  type: z.literal('document'),
  linkUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummaryEncoder,
});

export const resourceWithSignedUrlEncoder = z.discriminatedUnion('type', [
  linkResourceEncoder,
  documentResourceEncoder,
]);

const inCollectionFields = {
  collectionId: z.string().uuid(),
  sortOrder: z.number(),
};

const linkResourceInCollectionEncoder = z.object({
  ...resourceBase,
  ...inCollectionFields,
  type: z.literal('link'),
  linkUrl: z.string(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceInCollectionEncoder = z.object({
  ...resourceBase,
  ...inCollectionFields,
  type: z.literal('document'),
  linkUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummaryEncoder,
});

export const resourceInCollectionEncoder = z.discriminatedUnion('type', [
  linkResourceInCollectionEncoder,
  documentResourceInCollectionEncoder,
]);

export const resourceListEncoder = z.object({
  collectionId: z.string().uuid().nullable(),
  resources: z.array(resourceInCollectionEncoder),
});

export const collectionEncoder = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number(),
  addedByProfileUserId: z.string().uuid().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
