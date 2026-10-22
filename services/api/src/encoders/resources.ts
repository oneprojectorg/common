// The shape duplication with @op/common/services/resources/schemas.ts is
// intentional — do not collapse it into a re-export.
import { list, paginated } from '@op/common/client';
import { z } from 'zod';

export const attachmentSummaryEncoder = z.object({
  storageObjectId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nullable(),
});

const resourceBaseShape = {
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  addedByProfileId: z.string().uuid().nullable(),
  // Drizzle returns ISO strings (`mode: 'string'`). Not `z.coerce.date()` —
  // tRPC skips `.output()` validation in prod, so the client gets the raw
  // string and `.toISOString()` would blow up.
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  signedUrl: z.string().nullable(),
};

const linkResourceEncoder = z.object({
  ...resourceBaseShape,
  type: z.literal('link'),
  linkUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceEncoder = z.object({
  ...resourceBaseShape,
  type: z.literal('document'),
  linkUrl: z.null(),
  thumbnailUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummaryEncoder,
});

export const resourceWithSignedUrlEncoder = z.discriminatedUnion('type', [
  linkResourceEncoder,
  documentResourceEncoder,
]);

const inCollectionFields = {
  collectionId: z.string().uuid(),
  sortKey: z.string(),
};

const linkResourceInCollectionEncoder = z.object({
  ...resourceBaseShape,
  ...inCollectionFields,
  type: z.literal('link'),
  linkUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceInCollectionEncoder = z.object({
  ...resourceBaseShape,
  ...inCollectionFields,
  type: z.literal('document'),
  linkUrl: z.null(),
  thumbnailUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummaryEncoder,
});

export const resourceInCollectionEncoder = z.discriminatedUnion('type', [
  linkResourceInCollectionEncoder,
  documentResourceInCollectionEncoder,
]);
export type ResourceInCollection = z.infer<typeof resourceInCollectionEncoder>;

// `next` is the sortKey cursor of the last item; null at the end.
export const resourceListEncoder = paginated(
  resourceInCollectionEncoder,
).extend({
  collectionId: z.string().uuid().nullable(),
});
export type ResourceList = z.infer<typeof resourceListEncoder>;

// Flattened across a profile's collections (resources.list), so no top-level
// collectionId/cursor — each item carries its own collectionId.
export const profileResourceListEncoder = list(resourceInCollectionEncoder);
export type ProfileResourceList = z.infer<typeof profileResourceListEncoder>;

export const collectionEncoder = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortKey: z.string(),
  addedByProfileId: z.string().uuid().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const collectionListEncoder = paginated(collectionEncoder);
