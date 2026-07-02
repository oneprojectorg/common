// Overview hero-image upload flow: storage path prefix. Bucket, sanitizer,
// MIME allowlist, size cap (IMAGE_UPLOAD_SIZE_LIMIT), and the upload
// trust-boundary check all live in `utils/storage.ts`, shared with proposal
// attachments and resource documents so the features can't drift.

export const overviewHeroImagePathPrefix = (instanceId: string) =>
  `${instanceId}/overview/`;
