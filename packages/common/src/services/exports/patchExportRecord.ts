import { get, set } from '@op/cache';

import { EXPORT_CACHE_TTL_SECONDS } from './constants';

export const patchExportRecord = async (
  cacheKey: string,
  updates: Record<string, unknown>,
): Promise<void> => {
  const existing = await get(cacheKey);
  const base =
    typeof existing === 'object' && existing !== null ? existing : {};

  await set(cacheKey, { ...base, ...updates }, EXPORT_CACHE_TTL_SECONDS);
};
