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

// Default per-feature upload size cap. Individual features may lower this
// (e.g. avatars) or raise it if a business need justifies it, but sharing
// the default keeps unrelated features from silently drifting apart at
// 25MB vs 24MB etc.
export const DEFAULT_UPLOAD_SIZE_LIMIT = 25 * 1024 * 1024;

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
