/**
 * Content-Security-Policy construction.
 *
 * Plain `.mjs` (not `.ts`) because `next.config.mjs` is loaded by Node as ESM
 * before any TypeScript transform runs, and it needs the same policy the proxy
 * uses. This module owns the whole header contract — name and value — so a
 * disposition or a directive cannot apply to only half the app's responses.
 *
 * Two policy shapes, because two kinds of route:
 *
 * - Dynamically rendered routes get a nonce. The proxy mints one per request
 *   and puts the policy on the *request* headers; Next reads it back out
 *   (`getScriptNonceFromHeader`) and stamps that nonce on every script it
 *   emits, so `'strict-dynamic'` can carry trust to the chunks and
 *   third-party scripts those bootstrap scripts inject.
 * - Prerendered routes get the static policy. Their HTML is built once, with
 *   no request to mint a nonce from, so a per-request nonce would never match
 *   and `'strict-dynamic'` would block every script on the page.
 *
 * `STATIC_POLICY_SOURCES` names the routes on that second path. No response
 * may carry both policies: two Content-Security-Policy headers are
 * intersected, and a nonce-free policy intersected with a nonce policy blocks
 * every script on the page. `proxy.test.ts` asserts the declared patterns do
 * not overlap, but that is not enough on its own — Next compiles
 * `config.matcher` case-sensitively and matches `headers()` sources
 * case-insensitively, so `/Login` reaches both. `isStaticPolicyPath` is the
 * authority: the proxy asks it and declines rather than trusting the patterns.
 */

const CSP_REPORT_PATH = '/api/csp-report';

/** Group name shared by the `report-to` directive and `Reporting-Endpoints`. */
const CSP_REPORT_GROUP = 'csp-endpoint';

export const REPORTING_ENDPOINTS_HEADER = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

/**
 * The HTML route trees served the static policy. `/info/*` is `force-static`;
 * `/login` sits outside `app/[locale]`, so routing it through the proxy would
 * send it through the locale redirect to an `/en/login` that does not exist.
 */
const STATIC_POLICY_PREFIXES = ['/login', '/info'];

/** The same trees as `next.config.mjs` header sources. */
export const STATIC_POLICY_SOURCES = STATIC_POLICY_PREFIXES.map(
  (prefix) => `${prefix}/:path*`,
);

/**
 * Whether `next.config.mjs` already serves this path the static policy.
 *
 * The proxy checks this and declines to add its own. Matching here rather
 * than trusting the two pattern languages to stay disjoint: `next start`
 * matches `headers()` sources case-insensitively while `config.matcher` is
 * case-sensitive, so `/Login` reaches both emitters. (On Vercel the header
 * regex is applied from `routes-manifest.json` without the `i` flag, so
 * `/Login` instead reaches neither — harmless, because a path with no locale
 * prefix is redirected before anything renders.)
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
 * Whether this build talks to its backends over cleartext.
 *
 * Deployed, the tRPC API, Supabase and *.collab.tiptap.cloud are all
 * https/wss. Locally they are not — the API answers on http://localhost and
 * Supabase realtime on ws://127.0.0.1 — so `connect-src` has to admit
 * cleartext there, and must never admit it anywhere else.
 *
 * Asking whether the backends are cleartext, rather than trying to recognise
 * the environment, is what makes this both fail-closed and hard to get wrong.
 * `NODE_ENV` disagrees across the two emitters (Next inlines it into the
 * proxy bundle at build, `next.config.mjs` reads the ambient value) and would
 * have blocked tRPC on a production build run against the local stack;
 * `!VERCEL_ENV` read any build without that variable — a container, CI
 * without system env vars, a move off Vercel — as local and shipped `http:`
 * to production. `NEXT_PUBLIC_SUPABASE_URL` is required, is inlined
 * identically for both emitters, and is cleartext exactly when the rest of
 * the local stack is.
 */
const isLocalEnvironment = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http://') ?? false;

/**
 * `CSP_MODE=report-only` switches disposition at deploy time, so a policy that
 * breaks production is an environment change plus a redeploy rather than a
 * revert. `next.config.mjs` reads it at build time, so the static half of the
 * app picks up a change only on rebuild.
 *
 * There is deliberately no "off": report-only already stops the policy
 * blocking anything, and keeps the violation reports that say why.
 */
const getCspHeaderName = () =>
  process.env.CSP_MODE === 'report-only'
    ? 'content-security-policy-report-only'
    : 'content-security-policy';

/**
 * The one script escape hatch the nonce policy keeps open.
 *
 * `packages/common/src/services/decision/schemaValidator.ts` runs ajv in the
 * browser to validate proposals against the JSON schema stored on their
 * decision process. ajv compiles every schema with `Function(...)` and has no
 * interpreted fallback — it throws — and the schemas are authored per process
 * and read from the database, so ajv's precompiled standalone mode does not
 * apply. Dropping this blanks every proposal, review and process-builder form.
 *
 * It costs less than it looks: `'unsafe-eval'` matters when attacker input
 * reaches an eval sink, and the nonce plus `'strict-dynamic'` is what stops an
 * injected `<script>` running at all. The way to close it is to replace the
 * ajv-backed validator with one that interprets schemas rather than compiling
 * them, not to tighten the directive.
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
 * @param {Array<string>} scriptSources
 * @param {{ isLocalEnvironment: boolean }} params
 */
const assemble = (scriptSources, { isLocalEnvironment }) =>
  [
    `script-src ${scriptSources.join(' ')}`,
    ...buildSharedDirectives({ isLocalEnvironment }),
  ].join('; ');

/**
 * Strict CSP for dynamically rendered routes.
 *
 * `https:` and `'unsafe-inline'` are deliberate fallbacks, not weakening: a
 * browser that understands `'strict-dynamic'` ignores both, and one that does
 * not ignores the nonce and falls back to the host allowlist.
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
 * CSP for prerendered routes, whose scripts carry no nonce.
 *
 * `'unsafe-inline'` is required here: the HTML was built without a nonce, so
 * Next's bootstrap scripts are plain inline scripts. No `'unsafe-eval'` —
 * these routes are the login screen and static legal text, and none of them
 * reaches the decision-schema validator that forces it elsewhere.
 *
 * Denying it does cost one violation report per page load: zod probes
 * `new Function('')` once to decide whether to JIT its object parsers and
 * falls back to an interpreted path when that throws. The page is unaffected.
 * Granting eval on the login screen to quiet a report the browser is right to
 * send is the wrong trade; if the volume needs cutting, sample at
 * `app/api/csp-report`.
 *
 * @param {{ isLocalEnvironment: boolean }} params
 */
export const buildStaticContentSecurityPolicy = ({ isLocalEnvironment }) =>
  assemble(
    [
      "'self'",
      "'unsafe-inline'",
      // posthog-js loads its recorder through the /stats rewrite, but falls
      // back to the asset host directly if the proxy path is unavailable.
      'https://eu-assets.i.posthog.com',
    ],
    { isLocalEnvironment },
  );

/**
 * 16 random bytes, base64. Matches Next's nonce grammar
 * (`/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/`).
 */
export const createCspNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes));
};

/**
 * The header for a prerendered route, for `next.config.mjs` to serve over
 * `STATIC_POLICY_SOURCES`.
 *
 * @returns {{ key: string, value: string }}
 */
export const getStaticCspHeader = () => ({
  key: getCspHeaderName(),
  value: buildStaticContentSecurityPolicy({
    isLocalEnvironment: isLocalEnvironment(),
  }),
});

/**
 * One request's policy, as a function that stamps it onto a `Headers`.
 *
 * The proxy applies the same policy twice — to the headers it forwards to the
 * renderer and to the response it returns — and both must carry the identical
 * nonce, so the nonce is minted once here and closed over.
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
