// Supabase Storage objects expose `metadata` as opaque jsonb. These helpers
// safely narrow the well-known fields without an `as` cast. They are pure —
// no database or server-only imports — so the utils barrel stays importable
// from client-safe entry points. The row lookup that needs the DB lives
// in `./storageObject.ts`, which is intentionally not re-exported by the
// utils barrel.

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
