// Preview URL configuration
// Shared between next.config.mjs (build-time) and TypeScript code (runtime)

export const PREVIEW_DOMAIN_SUFFIX = '-oneproject.vercel.app';

/**
 * Get the preview API URL for proxy configuration.
 * @param {string | undefined} branchUrl - The VERCEL_BRANCH_URL value
 * @returns {string | null} The preview API URL, or null if not applicable
 */
export function getPreviewApiUrl(branchUrl) {
  if (!branchUrl) return null;

  const isOnPreviewDomain = branchUrl.endsWith(PREVIEW_DOMAIN_SUFFIX);
  if (!isOnPreviewDomain || !branchUrl.startsWith('app-')) {
    return null;
  }

  // Replace "app" prefix with "api"
  const suffix = branchUrl.slice(3); // "-git-branch-oneproject.vercel.app"
  return `https://api${suffix}`;
}

/**
 * Check if a URL is on a preview domain
 * @param {string | undefined} url - The deployment URL
 * @returns {boolean}
 */
export function isPreviewDomain(url) {
  return url?.endsWith(PREVIEW_DOMAIN_SUFFIX) ?? false;
}
