// Shared constants for the decision overview hero background-image upload.
// Single source of truth for the client picker (useOverviewBackgroundImage),
// the server mutation (uploadOverviewBackgroundImage), so the two layers can't
// drift. No server-only imports — safe to import from `@op/common/client`.

// The image rides through the tRPC body as base64. Vercel caps the serverless
// request body at ~4.5MB and base64 inflates ~33%, so anything over ~3.3MB raw
// is rejected by the platform (a 413 the tRPC client can't parse as JSON)
// before our handler runs. Cap well under that.
export const MAX_BACKGROUND_IMAGE_SIZE = 3 * 1024 * 1024;

export const ALLOWED_BACKGROUND_IMAGE_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];
