/**
 * Shared configuration for the proposal export pipeline.
 *
 * The API service, the `@op/common` service layer, and the Inngest workflow all
 * read and write the same export record (the `proposal_exports` table) and the
 * same storage object, so the bucket name and key format have to agree across
 * all three.
 */

import { ASSETS_BUCKET } from '../../../utils/storage';

/**
 * Exports are written to the shared `assets` bucket.
 *
 * Aliased from {@link ASSETS_BUCKET} rather than repeating the literal, so a
 * future migration to per-feature buckets stays the single-file change that
 * constant promises. Renaming the bucket in one place and not the other would
 * strand every export.
 *
 * `assets` is public: `apps/app/next.config.mjs` rewrites `/assets/:path*` to
 * the bucket's public object root, and `getPublicUrl()` builds every avatar and
 * organization image URL from it. So an export object is readable by anyone who
 * has its path — the CSV carries submitter names, and the only thing standing
 * between it and an anonymous reader is that the key is not enumerable.
 *
 * The signed URLs minted downstream are therefore a convenience (they expire,
 * so a shared link goes stale) rather than an access boundary: the unsigned
 * public URL for the same object resolves regardless of signature. Treat the
 * random component of the generated file name — minted in the export
 * workflow's `upload-to-storage` step — as the actual control, and do not
 * weaken it.
 */
export const EXPORTS_BUCKET = ASSETS_BUCKET;

/**
 * Lifetime of a generated signed download URL.
 *
 * The export record (`proposal_exports`) is durable and does not expire, so a
 * lapsed URL is always re-signable: an admin returning to a finished export
 * gets a freshly minted URL from `getExportStatus` instead of a 404.
 *
 * Note this bounds the *signed* URL only. Objects live in the public `assets`
 * bucket (see {@link EXPORTS_BUCKET}), so expiry does not revoke access to the
 * underlying file — it only invalidates the signature on this particular link.
 */
export const EXPORT_URL_TTL_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * Expiry to record for a signed URL minted just now.
 *
 * Both the Inngest workflow (minting the first URL) and `getExportStatus`
 * (re-signing a lapsed one) compute this; sharing it keeps the two mint sites
 * from drifting the way the bucket/TTL constants once did (see the module
 * comment above).
 */
export const nextUrlExpiresAt = () =>
  new Date(Date.now() + EXPORT_URL_TTL_SECONDS * 1000);

/**
 * Storage key for an export's generated file, relative to
 * {@link EXPORTS_BUCKET}.
 *
 * Shaped `<entity>/<id>/<sub-resource>/<file>` to match the other writers
 * sharing this bucket — `profile/${profileId}/resources/` and
 * `profiles/${profileId}/${imageType}/`. Leading with `proposals/` (as this
 * did) reads as though the owning entity were a proposal, when the export is
 * scoped to a process instance and covers many proposals.
 */
export const exportFilePath = (processInstanceId: string, fileName: string) =>
  `process/${processInstanceId}/proposals/${fileName}`;

/**
 * File name for a generated export.
 *
 * The random component is the access control for these objects. They live in
 * the public {@link EXPORTS_BUCKET}, so anyone holding this name can read the
 * CSV — and the CSV carries submitter names. A whole UUID is used rather than
 * a truncation of one: the timestamp beside it is largely inferable, so the
 * UUID has to carry the unguessability by itself.
 *
 * `crypto.randomUUID()` is the global Web Crypto API, available in Node 19+ and
 * in browsers, so this module stays free of Node-only imports.
 */
export const exportFileName = (extension: string) =>
  `proposals_export_${crypto.randomUUID()}_${Date.now()}.${extension}`;
