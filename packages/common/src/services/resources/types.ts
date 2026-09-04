import { PAGE_LIMIT } from '../../utils/pagination';

export const RESOURCE_LIST_DEFAULT_LIMIT = PAGE_LIMIT.lg;
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
