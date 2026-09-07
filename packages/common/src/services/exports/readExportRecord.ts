import { getWithStatus } from '@op/cache';
import { logger } from '@op/logging';
import type { ZodType } from 'zod';

import { CommonError } from '../../utils';

/**
 * Read one export's cached status record and validate it.
 *
 * Every export pipeline stores its state only in the cache — no table stands
 * behind it — so this is the whole read path, and the schema a caller passes is
 * the only check on the shape.
 *
 * Two failures the caller must not conflate are settled here.
 *
 * "The cache did not answer" is not "there is no such export". Both arrived as
 * `null` once. A client retires the export id when it reads not-found, so one
 * Redis timeout reported as a miss discarded a finished run: the file was gone
 * from the only place that knew about it, and the retry the client offered
 * pointed at a control no longer on screen. This throws instead.
 *
 * A record that fails the schema is reachable rather than theoretical. A
 * workflow patches the record by merging over the copy it reads, and writes the
 * patch alone when that read misses — so a cache eviction, or one unreachable
 * Redis, leaves a record holding a status and nothing else. Such a record
 * describes no export and no later read repairs it. It also carries no owner to
 * authorize against, which is why this returns null before any caller can check
 * one.
 *
 * @param exportId - The run the record describes. Logging only; `cacheKey` is
 *   what the read uses.
 * @param cacheKey - Where the record lives. Each pipeline owns its key format.
 * @param schema - Validates the cached value. Each pipeline owns its record
 *   shape.
 * @returns The parsed record, or null when the cache held nothing usable.
 * @throws CommonError when the cache did not answer.
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
