import type {
  resourceInCollectionEncoder,
  resourceListEncoder,
} from '@op/api/encoders';
import type { z } from 'zod';

export type ResourceListPayload = z.infer<typeof resourceListEncoder>;
export type ResourceItem = z.infer<typeof resourceInCollectionEncoder>;
