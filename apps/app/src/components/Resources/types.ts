import type { RouterOutput } from '@op/api/client';

export type ResourceListPayload = RouterOutput['resources']['list'];
export type ResourceItem = ResourceListPayload['resources'][number];
