import { type DbClient, db } from '@op/db/client';
import type { FormSchema } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * In-process cache of schema rows by id. Safe without invalidation because
 * `form_schemas` rows are never updated — a template edit inserts a new
 * version and moves the owner's pointer. Bounded so a long-lived server
 * process cannot grow it without limit; eviction is oldest-inserted-first,
 * which for an append-only lineage is close enough to LRU.
 */
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, FormSchema>();

/**
 * Loads one form-schema version. Throws when the id does not resolve: a
 * dangling pointer is a bug in a write path, and silently falling back to an
 * inline copy would read values against the wrong schema.
 */
export async function getFormSchema(
  id: string,
  tx?: DbClient,
): Promise<FormSchema> {
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }

  const client = tx ?? db;
  const row = await client.query.formSchemas.findFirst({ where: { id } });

  if (!row) {
    throw new NotFoundError('Form schema', id);
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) {
      cache.delete(oldest.value);
    }
  }
  cache.set(id, row);

  return row;
}
