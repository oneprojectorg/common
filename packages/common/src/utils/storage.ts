// Supabase Storage objects expose `metadata` as opaque jsonb. These helpers
// safely narrow the well-known fields without an `as` cast. They are pure —
// no database or server-only imports — so the utils barrel stays importable
// from client-safe entry points. The two server-side helpers that back this
// module (`getStorageObjectByPath`, `signStorageUploadUrl`) live in their
// own files and are intentionally not re-exported by the utils barrel.

import { NotFoundError, ValidationError } from './error';

// The bucket every user-uploaded storage object currently lives in — proposal
// attachments, resource documents, and (post-ONE-325) avatars / banners /
// post attachments. Keeping the bucket name in one place lets a future
// migration to per-feature buckets be a single-file change.
export const ASSETS_BUCKET = 'assets';

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

// Default per-feature upload size cap. Individual features may lower this
// (e.g. avatars) or raise it if a business need justifies it, but sharing
// the default keeps unrelated features from silently drifting apart at
// 25MB vs 24MB etc.
export const DEFAULT_UPLOAD_SIZE_LIMIT = 25 * 1024 * 1024;

// Cap for image uploads (banners, hero/header images, avatars). Images don't
// need the 25MB document default — an optimized wide banner sits well under
// 5MB — and a lower cap keeps the bytes next/image has to fetch and optimize
// sane.
export const IMAGE_UPLOAD_SIZE_LIMIT = 5 * 1024 * 1024;

// Sanitize a user-supplied filename before placing it in a storage key:
// drop any directory portion, then collapse anything outside the
// conservative `[A-Za-z0-9._-]` set to underscores and cap the length.
// Pure ASCII / no external library because the two-line rule here is
// stricter than what `sanitize-filename` / `filenamify` enforce
// (Windows-illegal characters only), and we prefer known behaviour over
// a dep whose ruleset can shift under us.
export const sanitizeStorageFileName = (raw: string): string => {
  const base = raw.split(/[/\\]/).pop() ?? raw;
  return base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 255);
};

// Single unified allowlist covering every user-uploaded storage object
// (proposal attachments, resource documents, and — once ONE-325 lands —
// avatars / banners / post attachments). Each type here needs to satisfy
// the same trust rule: Supabase serves the file with the Content-Type
// sent on PUT and we don't sniff bytes, so a type belongs on this list
// only if (a) it has a distinctive magic-byte signature we could add
// verification for later, or (b) we force `Content-Disposition:
// attachment` so it's never rendered inline. text/csv and text/plain
// deliberately excluded on that basis.
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export const isAllowedUploadMimeType = (
  mimeType: string,
): mimeType is AllowedUploadMimeType =>
  (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);

// Server-side trust-boundary check on a client-supplied `storagePath`.
// Runs the checks every "record the upload" endpoint has to do against
// the Supabase-recorded object metadata (never the client's declared
// MIME): (1) object exists, (2) is inside the caller's expected path
// prefix, (3) has a stored Content-Type on the allowlist, (4) that
// Content-Type matches what the client declared, and (5) is within the
// size cap. Callers pass the object they just fetched by (bucket, path)
// via `getStorageObjectByPath`.
export const assertUploadedStorageObject = ({
  storageObject,
  storagePath,
  requiredPathPrefix,
  declaredMimeType,
  maxFileSize,
}: {
  storageObject: { id: string; metadata: unknown } | undefined;
  storagePath: string;
  requiredPathPrefix: string;
  declaredMimeType: string;
  maxFileSize: number;
}): {
  storageObjectId: string;
  storedMimeType: AllowedUploadMimeType;
  fileSize: number;
} => {
  if (!storageObject) {
    throw new NotFoundError('Storage object', storagePath);
  }
  // The signed URL is path-scoped, but the client supplies the path back to
  // us here — reject anything outside the caller's own prefix so they can't
  // claim someone else's just-uploaded object.
  if (!storagePath.startsWith(requiredPathPrefix)) {
    throw new ValidationError('Storage object does not belong to this profile');
  }
  // Supabase records the Content-Type sent on PUT into the object metadata
  // and serves the file back with that same header. Trust the storage record
  // (not the caller's declared `mimeType`), then re-check the allowlist.
  const storedMimeType = getStorageObjectMimeType(storageObject.metadata);
  if (!storedMimeType || !isAllowedUploadMimeType(storedMimeType)) {
    throw new ValidationError('Uploaded file has an unsupported content type');
  }
  if (storedMimeType !== declaredMimeType) {
    throw new ValidationError(
      'Declared mimeType does not match the uploaded file',
    );
  }
  // Storage object size is the only place we see the actual upload size —
  // the signed PUT URL itself has no inherent cap.
  const fileSize = getStorageObjectSize(storageObject.metadata);
  if (fileSize === null || fileSize > maxFileSize) {
    throw new ValidationError('Uploaded file exceeds the size limit');
  }
  return { storageObjectId: storageObject.id, storedMimeType, fileSize };
};
