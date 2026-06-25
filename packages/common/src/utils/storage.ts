import { db } from '@op/db/client';
import { objectsInStorage } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

// Supabase Storage objects expose `metadata` as opaque jsonb. These helpers
// safely narrow the well-known fields without an `as` cast.

/**
 * Resolve the storage object row a client just uploaded into via a signed URL.
 * Looked up by (bucket, name) because the client only knows the path it
 * received from sign-upload — not the object UUID.
 */
export const getStorageObjectByPath = async (input: {
  bucketId: string;
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
        eq(objectsInStorage.bucketId, input.bucketId),
        eq(objectsInStorage.name, input.path),
      ),
    )
    .limit(1);

  return row;
};

export const getStorageObjectSize = (metadata: unknown): number | null => {
  if (
    metadata &&
    typeof metadata === 'object' &&
    'size' in metadata &&
    typeof metadata.size === 'number'
  ) {
    return metadata.size;
  }
  return null;
};

export const getStorageObjectMimeType = (metadata: unknown): string | null => {
  if (
    metadata &&
    typeof metadata === 'object' &&
    'mimetype' in metadata &&
    typeof metadata.mimetype === 'string'
  ) {
    return metadata.mimetype;
  }
  return null;
};
