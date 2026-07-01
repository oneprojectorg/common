import { db } from '@op/db/client';
import { objectsInStorage } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

import { ASSETS_BUCKET } from './storage';

/**
 * Resolve the storage object row a client just uploaded into via a signed URL.
 * Looked up by (bucket, name) because the client only knows the path it
 * received from sign-upload — not the object UUID. `bucketId` defaults to
 * `ASSETS_BUCKET`, which is where every user-uploaded object currently
 * lives; pass a different bucket if a future feature routes elsewhere.
 *
 * Lives outside the utils barrel because it imports `@op/db/client` (which is
 * `server-only`); putting it in `./storage.ts` poisoned the client-safe entry
 * point with a server-only transitive dependency.
 */
export const getStorageObjectByPath = async (input: {
  bucketId?: string;
  path: string;
}): Promise<{ id: string; metadata: unknown } | undefined> => {
  const [row] = await db
    .select({
      id: objectsInStorage.id,
      metadata: objectsInStorage.metadata,
    })
    .from(objectsInStorage)
    .where(
      and(
        eq(objectsInStorage.bucketId, input.bucketId ?? ASSETS_BUCKET),
        eq(objectsInStorage.name, input.path),
      ),
    )
    .limit(1);

  return row;
};
