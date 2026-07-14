// Phase hero-image upload flow: storage path prefix. Bucket, sanitizer, MIME
// allowlist, size cap (IMAGE_UPLOAD_SIZE_LIMIT), and the upload trust-boundary
// check all live in `utils/storage.ts`, shared with the overview hero, proposal
// attachments, and resource documents so the features can't drift. Scoped per
// phase so each phase's banner lives under its own folder (mirrors the
// `${instanceId}/overview/` overview prefix).

export const phaseHeroImagePathPrefix = (instanceId: string, phaseId: string) =>
  `${instanceId}/phase/${phaseId}/`;
