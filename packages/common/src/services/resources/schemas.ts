import {
  resourceCollectionProfiles,
  resourceCollections,
  resources,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const attachmentSummarySchema = z.object({
  storageObjectId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nullable(),
});
export type AttachmentSummary = z.infer<typeof attachmentSummarySchema>;

// Timestamp columns use `mode: 'string'`, so createSelectSchema yields
// `z.string().nullable()` — exactly what we want on the wire. tRPC skips
// `.output()` validation in prod, so the client receives the raw ISO string;
// a `z.coerce.date()` here would mistype it as a `Date`.
const resourceSelect = createSelectSchema(resources);

const resourceBaseShape = {
  id: resourceSelect.shape.id,
  title: resourceSelect.shape.title,
  description: resourceSelect.shape.description,
  addedByProfileId: resourceSelect.shape.addedByProfileId,
  createdAt: resourceSelect.shape.createdAt,
  updatedAt: resourceSelect.shape.updatedAt,
  signedUrl: z.string().nullable(),
};

const linkResourceSchema = z.object({
  ...resourceBaseShape,
  type: z.literal('link'),
  linkUrl: z.string(),
  // OG / oEmbed thumbnail resolved at hydration time via the link-preview
  // service. Server-side hydration here avoids the per-card client query
  // (would be O(N) requests on a list of N link resources).
  thumbnailUrl: z.string().nullable(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceSchema = z.object({
  ...resourceBaseShape,
  type: z.literal('document'),
  linkUrl: z.null(),
  thumbnailUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummarySchema,
});

export const resourceWithSignedUrlSchema = z.discriminatedUnion('type', [
  linkResourceSchema,
  documentResourceSchema,
]);
export type ResourceDTO = z.infer<typeof resourceWithSignedUrlSchema>;

const inCollectionFields = {
  collectionId: z.string().uuid(),
  sortKey: z.string(),
};

const linkResourceInCollectionSchema = z.object({
  ...resourceBaseShape,
  ...inCollectionFields,
  type: z.literal('link'),
  linkUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceInCollectionSchema = z.object({
  ...resourceBaseShape,
  ...inCollectionFields,
  type: z.literal('document'),
  linkUrl: z.null(),
  thumbnailUrl: z.null(),
  attachmentId: z.string().uuid(),
  attachment: attachmentSummarySchema,
});

export const resourceInCollectionSchema = z.discriminatedUnion('type', [
  linkResourceInCollectionSchema,
  documentResourceInCollectionSchema,
]);
export type ResourceInCollectionDTO = z.infer<
  typeof resourceInCollectionSchema
>;

export const resourceListSchema = z.object({
  collectionId: z.string().uuid().nullable(),
  items: z.array(resourceInCollectionSchema),
  // Cursor (sortKey of the last item) for the next page; null at end.
  next: z.string().nullable(),
});
export type ResourceListResult = z.infer<typeof resourceListSchema>;

// `id`/`name` come from the collection; `sortKey` and the audit fields come
// from the per-profile junction row (`resourceCollectionProfiles`).
const collectionSelect = createSelectSchema(resourceCollections);
const collectionProfileSelect = createSelectSchema(resourceCollectionProfiles);

export const collectionSchema = z.object({
  id: collectionSelect.shape.id,
  name: collectionSelect.shape.name,
  // `sortKey` is a custom `asciiText` column that drizzle-zod can't infer, so
  // declare it explicitly rather than reaching into the generated shape.
  sortKey: z.string(),
  addedByProfileId: collectionProfileSelect.shape.addedByProfileId,
  createdAt: collectionProfileSelect.shape.createdAt,
  updatedAt: collectionProfileSelect.shape.updatedAt,
});
export type CollectionDTO = z.infer<typeof collectionSchema>;

export const collectionListSchema = z.object({
  items: z.array(collectionSchema),
  next: z.string().nullable(),
});
export type CollectionListResult = z.infer<typeof collectionListSchema>;
