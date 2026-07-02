import { invalidateMultiple } from '@op/cache';

/**
 * Invalidate the cached flattened resource list (`listResources`, keyed
 * `[profileId, 'list']`) for every profile that can see the affected
 * collection. Call from any mutation that changes what the list shows:
 * collection membership (create/delete/attach/detach), item order, resource
 * fields, or collection order — the same places that broadcast
 * `Channels.profileResources` / `Channels.profileCollections`.
 */
export const invalidateProfileResources = (profileIds: string[]) =>
  invalidateMultiple({
    type: 'resources',
    paramsList: profileIds.map((profileId) => [profileId, 'list']),
  });
