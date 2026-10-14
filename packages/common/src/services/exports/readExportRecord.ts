import { getWithStatus } from '@op/cache';
import { logger } from '@op/logging';
import type { ZodType } from 'zod';

import { CommonError } from '../../utils';

/**
 * Read and validate an export's cached status record, or null when the cache held
 * nothing valid. Throws when the cache did not answer, so a Redis timeout is not
 * reported as `not_found`.
 */
export const readExportRecord = async <T>({
  exportId,
  cacheKey,
  schema,
}: {
  exportId: string;
  cacheKey: string;
  schema: ZodType<T>;
}): Promise<T | null> => {
  const cached = await getWithStatus(cacheKey);

  if (cached.status === 'timeout' || cached.status === 'error') {
    throw new CommonError('Could not read the export record.');
  }

  if (cached.status !== 'hit') {
    return null;
  }

  const parsed = schema.safeParse(cached.data);

  if (!parsed.success) {
    logger.error('Cached export record does not match its schema', {
      exportId,
      error: parsed.error,
    });

    return null;
  }

  return parsed.data;
};
