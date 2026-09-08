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

const resourceBaseSchema = resourceSelect
  .pick({
    id: true,
    title: true,
    description: true,
    addedByProfileId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    signedUrl: z.string().nullable(),
  });

const linkResourceSchema = resourceBaseSchema.extend({
  type: z.literal('link'),
  linkUrl: z.string(),
  // OG / oEmbed thumbnail resolved at hydration time via the link-preview
  // service. Server-side hydration here avoids the per-card client query
  // (would be O(N) requests on a list of N link resources).
  thumbnailUrl: z.string().nullable(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceSchema = resourceBaseSchema.extend({
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

const resourceInCollectionBaseSchema = resourceBaseSchema.extend({
  collectionId: z.string().uuid(),
  sortKey: z.string(),
});

const linkResourceInCollectionSchema = resourceInCollectionBaseSchema.extend({
  type: z.literal('link'),
  linkUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  attachmentId: z.null(),
  attachment: z.null(),
});

const documentResourceInCollectionSchema =
  resourceInCollectionBaseSchema.extend({
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

export const collectionSchema = collectionSelect
  .pick({ id: true, name: true })
  .extend({
    // `sortKey` is a custom `asciiText` column that drizzle-zod can't infer,
    // so declare it explicitly rather than reaching into the generated shape.
    sortKey: z.string(),
  })
  .extend(
    collectionProfileSelect.pick({
      addedByProfileId: true,
      createdAt: true,
      updatedAt: true,
    }).shape,
  );
export type CollectionDTO = z.infer<typeof collectionSchema>;

export const collectionListSchema = z.object({
  items: z.array(collectionSchema),
  next: z.string().nullable(),
});
export type CollectionListResult = z.infer<typeof collectionListSchema>;
