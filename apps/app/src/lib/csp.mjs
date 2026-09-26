/**
 * Content-Security-Policy construction, shared by the two places that emit it:
 * `src/proxy.ts` for dynamically rendered routes, `next.config.mjs` for the
 * routes it skips. Plain `.mjs` so `next.config.mjs` can import it before any
 * TypeScript transform runs.
 *
 * No response may carry both policies — two CSP headers are intersected, and a
 * nonce-free policy intersected with a nonce policy blocks every script.
 */

const CSP_REPORT_PATH = '/api/csp-report';
const CSP_REPORT_GROUP = 'csp-endpoint';

export const REPORTING_ENDPOINTS_HEADER = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

/**
 * Routes served the static policy. `/info/*` is `force-static`, so its HTML is
 * built once with no request to mint a nonce from; `/login` sits outside
 * `app/[locale]`, so the proxy would redirect it to a nonexistent `/en/login`.
 */
const STATIC_POLICY_PREFIXES = ['/login', '/info'];

export const STATIC_POLICY_SOURCES = STATIC_POLICY_PREFIXES.map(
  (prefix) => `${prefix}/:path*`,
);

/**
 * Whether `next.config.mjs` already covers this path, so the proxy can decline.
 * Matched here rather than trusting the two patterns to stay disjoint: Next
 * compiles `config.matcher` case-sensitively but matches `headers()` sources
 * case-insensitively, so `/Login` reaches both.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export const isStaticPolicyPath = (pathname) => {
  const lower = pathname.toLowerCase();

  return STATIC_POLICY_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(`${prefix}/`),
  );
};

/**
 * Locally the API answers on http://localhost and Supabase realtime on
 * ws://127.0.0.1, so `connect-src` has to admit cleartext — and must never
 * admit it anywhere else. Keyed on whether the backend is cleartext rather
 * than on the environment, which fails closed and is inlined identically for
 * both emitters.
 */
const isLocalEnvironment = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http://') ?? false;

/** `CSP_MODE=report-only` is the rollback lever: same policy, nothing blocked. */
const getCspHeaderName = () =>
  process.env.CSP_MODE === 'report-only'
    ? 'content-security-policy-report-only'
    : 'content-security-policy';

/**
 * `schemaValidator.ts` runs ajv in the browser against JSON schemas stored per
 * decision process. ajv compiles with `Function(...)` and throws rather than
 * degrading, and database-authored schemas rule out its precompiled mode, so
 * dropping this blanks every proposal, review and process-builder form.
 */
const UNSAFE_EVAL = "'unsafe-eval'";

/** @param {{ isLocalEnvironment: boolean }} params */
const buildSharedDirectives = ({ isLocalEnvironment }) => [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  // React `style={{}}` attributes are everywhere; style injection is not the
  // attack this policy defends against.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https: wss:${isLocalEnvironment ? ' http: ws:' : ''}`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  // Iframely link previews render cross-origin <iframe>s.
  "frame-src 'self' https:",
  // report-uri is the only channel Firefox honors; Chromium uses report-to,
  // paired with the Reporting-Endpoints header.
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_REPORT_GROUP}`,
];

/**
 * @param {Array<string>} scriptSources
 * @param {{ isLocalEnvironment: boolean }} params
 */
const assemble = (scriptSources, { isLocalEnvironment }) =>
  [
    `script-src ${scriptSources.join(' ')}`,
    ...buildSharedDirectives({ isLocalEnvironment }),
  ].join('; ');

/**
 * `https:` and `'unsafe-inline'` are pre-CSP3 fallbacks, not weakening: a
 * browser honouring `'strict-dynamic'` ignores both.
 *
 * @param {{ nonce: string, isLocalEnvironment: boolean }} params
 */
export const buildNonceContentSecurityPolicy = ({
  nonce,
  isLocalEnvironment,
}) =>
  assemble(
    [
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      'https:',
      "'unsafe-inline'",
      UNSAFE_EVAL,
    ],
    { isLocalEnvironment },
  );

/**
 * Prerendered HTML has no nonce, so its bootstrap scripts need
 * `'unsafe-inline'`. No `'unsafe-eval'` — these routes never reach the
 * decision-schema validator.
 *
 * @param {{ isLocalEnvironment: boolean }} params
 */
export const buildStaticContentSecurityPolicy = ({ isLocalEnvironment }) =>
  assemble(
    [
      "'self'",
      "'unsafe-inline'",
      // posthog-js falls back to the asset host when the /stats rewrite is
      // unavailable.
      'https://eu-assets.i.posthog.com',
    ],
    { isLocalEnvironment },
  );

/** Matches Next's nonce grammar in `get-script-nonce-from-header`. */
export const createCspNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes));
};

/** @returns {{ key: string, value: string }} */
export const getStaticCspHeader = () => ({
  key: getCspHeaderName(),
  value: buildStaticContentSecurityPolicy({
    isLocalEnvironment: isLocalEnvironment(),
  }),
});

/**
 * The proxy stamps the same policy on the forwarded request headers and on the
 * response, so the nonce is minted once here and closed over.
 *
 * @returns {(headers: Headers) => Headers}
 */
export const createCspHeaderApplier = () => {
  const name = getCspHeaderName();
  const policy = buildNonceContentSecurityPolicy({
    nonce: createCspNonce(),
    isLocalEnvironment: isLocalEnvironment(),
  });

  return (headers) => {
    headers.set(name, policy);

    return headers;
  };
};
