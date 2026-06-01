export const RESOURCE_LIST_DEFAULT_LIMIT = 50;
export const RESOURCE_LIST_MAX_LIMIT = 200;

// The DTO definitions moved to schemas.ts (derived from zod via createSelectSchema).
// Re-exported here so existing `./types` imports keep resolving; callers should
// migrate to importing from './schemas' directly (follow-up).
export type {
  AttachmentSummary,
  ResourceDTO,
  ResourceInCollectionDTO,
  ResourceListResult,
  CollectionDTO,
  CollectionListResult,
} from './schemas';
