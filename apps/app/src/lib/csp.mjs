/**
 * Content-Security-Policy construction.
 *
 * Plain `.mjs` (not `.ts`) because `next.config.mjs` is loaded by Node as ESM
 * before any TypeScript transform runs, and it needs the same directive list
 * the proxy uses. Duplicating the list across the two emitters is how a
 * directive silently goes missing, so both import from here.
 *
 * Two shapes, because two kinds of route:
 *
 * - Dynamically rendered routes get `buildNonceContentSecurityPolicy`. The
 *   proxy mints a nonce per request and puts the policy on the *request*
 *   headers; Next reads it back out (`getScriptNonceFromHeader`) and stamps
 *   that nonce on every script it emits, so `'strict-dynamic'` can carry trust
 *   to the chunks and third-party scripts those bootstrap scripts inject.
 * - Prerendered routes get `buildStaticContentSecurityPolicy`. Their HTML is
 *   built once, with no request to mint a nonce from, so a per-request nonce
 *   would never match and `'strict-dynamic'` would block every script on the
 *   page. `/info/*` is `force-static` today; see `apps/app/next.config.mjs`.
 */

export const CSP_REPORT_PATH = '/api/csp-report';

/** Group name shared by the `report-to` directive and `Reporting-Endpoints`. */
export const CSP_REPORT_GROUP = 'csp-endpoint';

export const REPORTING_ENDPOINTS_HEADER = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

export const CSP_ENFORCE_HEADER = 'content-security-policy';
export const CSP_REPORT_ONLY_HEADER = 'content-security-policy-report-only';

/**
 * `CSP_MODE` picks the disposition at deploy time so that a policy that breaks
 * production is an environment change plus a redeploy, not a revert.
 *
 * @typedef {'enforce' | 'report-only' | 'off'} CspMode
 */

/**
 * @param {string | undefined} value
 * @returns {CspMode}
 */
export const parseCspMode = (value) =>
  value === 'report-only' || value === 'off' ? value : 'enforce';

/**
 * @param {CspMode} mode
 * @returns {string | null} Header name, or null when CSP is switched off.
 */
export const getCspHeaderName = (mode) => {
  if (mode === 'off') {
    return null;
  }

  return mode === 'report-only' ? CSP_REPORT_ONLY_HEADER : CSP_ENFORCE_HEADER;
};

/**
 * The one script escape hatch this policy cannot close.
 *
 * `packages/common/src/services/decision/schemaValidator.ts` runs ajv in the
 * browser to validate proposals against the JSON schema stored on their
 * decision process. ajv compiles every schema with `Function(...)` and has no
 * interpreted fallback — it throws — and the schemas are authored per process
 * and read from the database, so ajv's precompiled standalone mode does not
 * apply. Dropping this blanks every proposal, review and process-builder form.
 *
 * It costs less than it looks: `'unsafe-eval'` is dangerous when attacker
 * input reaches an eval sink, and the nonce plus `'strict-dynamic'` above is
 * what stops an injected `<script>` running in the first place. Removing it
 * means replacing the ajv-backed validator.
 */
const UNSAFE_EVAL = "'unsafe-eval'";

/**
 * Directives that do not depend on how scripts are trusted. Kept in one place
 * so the nonce policy and the static policy cannot drift apart.
 *
 * @param {{ isLocalEnvironment: boolean }} params
 */
const buildSharedDirectives = ({ isLocalEnvironment }) => [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  // React inline `style` attributes are used throughout the app, and Next
  // injects inline <style> in development. Style injection is not the attack
  // this policy is defending against.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // The tRPC API is a separate origin in every environment (api-common…,
  // api-dev…, api-git-… on previews), as are Supabase and
  // *.collab.tiptap.cloud. Every deployed one is https/wss.
  //
  // Locally they are not: the API is http://localhost:4300 and Supabase
  // realtime is ws://127.0.0.1. Without the local allowance every tRPC call
  // is blocked, so this is the difference between a working dev server and a
  // dead one — but it must never reach a deployed environment, where `http:`
  // would re-open the cleartext exfiltration channel https:/wss: closes.
  `connect-src 'self' https: wss:${isLocalEnvironment ? ' http: ws:' : ''}`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  // Iframely link previews render cross-origin <iframe>s.
  "frame-src 'self' https:",
  // `report-uri` is deprecated but remains the only channel Firefox honors;
  // Chromium uses `report-to`, paired with the `Reporting-Endpoints` header.
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_REPORT_GROUP}`,
];

/**
 * Strict CSP for dynamically rendered routes.
 *
 * `https:` and `'unsafe-inline'` are deliberate fallbacks, not weakening: a
 * browser that understands `'strict-dynamic'` ignores both, and one that does
 * not ignores the nonce and falls back to the host allowlist.
 *
 * @param {{ nonce: string, isLocalEnvironment?: boolean }} params
 */
export const buildNonceContentSecurityPolicy = ({
  nonce,
  isLocalEnvironment = false,
}) => {
  const scriptSrc = [
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    'https:',
    "'unsafe-inline'",
    UNSAFE_EVAL,
  ].join(' ');

  return [
    `script-src ${scriptSrc}`,
    ...buildSharedDirectives({ isLocalEnvironment }),
  ].join('; ');
};

/**
 * CSP for prerendered routes, whose scripts carry no nonce.
 *
 * `'unsafe-inline'` is required here: the HTML was built without a nonce, so
 * Next's bootstrap scripts are plain inline scripts. This is the same script
 * allowance these routes already run under, minus `'unsafe-eval'`.
 *
 * @param {{ isLocalEnvironment?: boolean }} [params]
 */
export const buildStaticContentSecurityPolicy = ({
  isLocalEnvironment = false,
} = {}) => {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    // posthog-js loads its recorder through the /stats rewrite, but falls back
    // to the asset host directly if the proxy path is unavailable.
    'https://eu-assets.i.posthog.com',
    UNSAFE_EVAL,
  ].join(' ');

  return [
    `script-src ${scriptSrc}`,
    ...buildSharedDirectives({ isLocalEnvironment }),
  ].join('; ');
};

/**
 * 16 random bytes, base64. Matches Next's nonce grammar
 * (`/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/`).
 */
export const createCspNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes));
};
