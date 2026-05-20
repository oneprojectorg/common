import { CommonError, UnauthorizedError } from '@op/common';
import { db } from '@op/db/client';
import { objectsInStorage } from '@op/db/schema';
import { createServerClient } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { and, eq } from 'drizzle-orm';

export const STORAGE_BUCKET = 'assets';
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

interface StorageObjectMetadata {
  size?: number;
  mimetype?: string;
}

export interface VerifiedStorageObject {
  id: string;
  size: number;
  mimetype: string;
}

export async function createSignedUploadUrl(path: string) {
  const supabase = createStorageAdmin();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error('createSignedUploadUrl failed', { path, error });
    throw new CommonError('Could not start upload. Please try again.');
  }

  return { signedUrl: data.signedUrl, path: data.path };
}

export function validateMimeAndSize({
  mimeType,
  fileSize,
  allowedMimeTypes,
  unsupportedMessage,
}: {
  mimeType: string;
  fileSize: number;
  allowedMimeTypes: readonly string[];
  unsupportedMessage?: string;
}) {
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new CommonError(unsupportedMessage ?? 'Unsupported file type');
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw new CommonError(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    );
  }
}

/**
 * Asserts the caller-supplied path matches the expected prefix and contains no
 * traversal segments. Throws UnauthorizedError on mismatch — a client trying
 * to claim a path under another caller's namespace is an authz failure, not a
 * server bug.
 */
export function validateStoragePath({
  path,
  expectedPrefix,
}: {
  path: string;
  expectedPrefix: string;
}) {
  if (!path.startsWith(expectedPrefix) || path.includes('..')) {
    throw new UnauthorizedError('Invalid attachment path');
  }
}

/**
 * Looks up an `objectsInStorage` row by bucket + path, retrying a few times
 * to absorb replication lag between the client's PUT and the row becoming
 * visible to our reader. Returns size + mimetype from the storage row's own
 * metadata so the record step uses storage-truth, not client echo.
 */
export async function findUploadedStorageObject({
  path,
  allowedMimeTypes,
  unsupportedMessage,
}: {
  path: string;
  allowedMimeTypes: readonly string[];
  unsupportedMessage?: string;
}): Promise<VerifiedStorageObject> {
  const RETRIES = 3;
  const BACKOFF_MS = 150;

  let row: { id: string; metadata: unknown } | undefined;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    const [found] = await db
      .select({ id: objectsInStorage.id, metadata: objectsInStorage.metadata })
      .from(objectsInStorage)
      .where(
        and(
          eq(objectsInStorage.bucketId, STORAGE_BUCKET),
          eq(objectsInStorage.name, path),
        ),
      );

    if (found) {
      row = found;
      break;
    }

    if (attempt < RETRIES - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, BACKOFF_MS * (attempt + 1)),
      );
    }
  }

  if (!row) {
    throw new CommonError('Upload could not be confirmed. Please try again.');
  }

  const metadata = (row.metadata ?? {}) as StorageObjectMetadata;
  const size = typeof metadata.size === 'number' ? metadata.size : undefined;
  const mimetype =
    typeof metadata.mimetype === 'string' ? metadata.mimetype : undefined;

  if (size === undefined || mimetype === undefined) {
    throw new CommonError('Upload could not be confirmed. Please try again.');
  }

  validateMimeAndSize({
    mimeType: mimetype,
    fileSize: size,
    allowedMimeTypes,
    unsupportedMessage,
  });

  return { id: row.id, size, mimetype };
}

/**
 * Fire-and-forget removal of a storage object. Used to clean up files after a
 * failed record step — without it, a PUT-then-record-failure leaks the object.
 */
export function scheduleStorageObjectCleanup(path: string) {
  waitUntil(
    (async () => {
      try {
        const supabase = createStorageAdmin();
        await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      } catch (err) {
        console.error('Failed to clean up orphaned storage object', {
          path,
          err,
        });
      }
    })(),
  );
}

export function createStorageAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new CommonError('Storage configuration missing');
  }

  return createServerClient(supabaseUrl, supabaseServiceRole, {
    cookieOptions: {},
    cookies: {
      getAll: async () => [],
      setAll: async () => {},
    },
  });
}
