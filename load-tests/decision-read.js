// k6 load test — anonymous READ paths for a public decision process.
//
// Models an anonymous visitor browsing a decision process under
// /decisions/<slug>: they land on the process, the page fetches the instance,
// categories, proposal list and voting status, then they open one or more
// proposals. All of these are public `openProcedure` tRPC queries.
//
// IMPORTANT — rate limiting:
//   Every public read endpoint is rate-limited in-memory keyed on
//   `${X-Forwarded-For}-${url}` (default 10 req / 10s; getDecisionBySlug 20,
//   getInstance 30). See services/api/src/lib/rateLimited.ts.
//   Running k6 from one machine means one source IP, so without intervention
//   all VUs would share a single bucket and you'd just measure 429s.
//   To both (a) simulate distinct real visitors and (b) avoid that artifact,
//   each VU is given a stable, unique X-Forwarded-For. Set SPOOF_IP=false to
//   disable that and exercise the limiter as-is.
//
// This exercises BOTH layers a real visitor hits:
//   1. the Next.js page GET (SSR/RSC render path) for the process and proposal
//      pages, and
//   2. the client-side tRPC queries those pages fire after hydration.
// The app and API are separate origins (e.g. app-dev.* vs api-dev.*), so you
// pass both APP_URL (the Next.js app) and BASE_URL (the tRPC base).
//
// Usage:
//   k6 run -e APP_URL=https://app-dev.oneproject.tech \
//          -e BASE_URL=https://api-dev.oneproject.tech/api/v1/trpc \
//          -e SLUG=my-decision-slug \
//          load-tests/decision-read.js
//
// Common knobs (all optional, shown with defaults):
//   -e TARGET_VUS=100  -e RAMP_UP=1m  -e HOLD=3m  -e RAMP_DOWN=30s
//   -e LOCALE=en                locale prefix for page URLs (/<locale>/decisions/..)
//   -e PROPOSAL_VIEW_PROB=0.6   fraction of iterations that open proposals
//   -e MAX_PROPOSALS=2          proposals opened per browsing iteration
//   -e THINK_MIN=1 -e THINK_MAX=4   per-action think time (seconds)
//   -e SPOOF_IP=true            unique X-Forwarded-For per VU
//   -e LIST_LIMIT=20            proposals fetched per list call
//   -e SKIP_PAGES=false         set true to test the API only (no SSR page GETs)

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ---- config ----------------------------------------------------------------
const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const APP_URL = (__ENV.APP_URL || '').replace(/\/$/, '');
const SLUG = __ENV.SLUG || '';
const LOCALE = __ENV.LOCALE || 'en';
const SKIP_PAGES = (__ENV.SKIP_PAGES || 'false') === 'true';

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '100', 10);
const RAMP_UP = __ENV.RAMP_UP || '1m';
const HOLD = __ENV.HOLD || '3m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '30s';

const PROPOSAL_VIEW_PROB = parseFloat(__ENV.PROPOSAL_VIEW_PROB || '0.6');
const MAX_PROPOSALS = parseInt(__ENV.MAX_PROPOSALS || '2', 10);
const THINK_MIN = parseFloat(__ENV.THINK_MIN || '1');
const THINK_MAX = parseFloat(__ENV.THINK_MAX || '4');
const SPOOF_IP = (__ENV.SPOOF_IP || 'true') !== 'false';
const LIST_LIMIT = parseInt(__ENV.LIST_LIMIT || '20', 10);

// ---- custom metrics ---------------------------------------------------------
const rateLimited = new Rate('rate_limited'); // share of requests that got 429
const trpcErrors = new Counter('trpc_errors'); // tRPC errors returned in body
const pageRedirected = new Rate('page_redirected'); // page GETs that 30x'd (e.g. to /login)

// ---- options ----------------------------------------------------------------
// Grafana Cloud k6 (`k6 cloud run`) only — ignored by local `k6 run`.
// Spreading across many load zones maximizes the number of distinct real source
// IPs, which is the only way to dodge the per-IP rate limiter without a server
// change (the per-VU X-Forwarded-For trick is rewritten by the Vercel proxy —
// see RUNBOOK §6). Each load zone is at least one instance with its own IP;
// k6 Cloud adds more instances (more IPs) as VUs-per-zone grows. Even so this
// yields IPs in the dozens, not thousands — expect some 429s on the tightest
// buckets (listProposals, 10 req/10s) at high VU counts. Set CLOUD_PROJECT_ID
// to file the run under your Grafana Cloud project.
//
// CLOUD_ZONES: comma-separated k6 load zones to split VUs across evenly. The
// free tier allows only ONE zone, so default to a single zone; widen it on a
// paid plan, e.g.
//   CLOUD_ZONES="amazon:us:ashburn,amazon:ie:dublin,amazon:jp:tokyo"
// The full ~10-zone set is in DEFAULT_CLOUD_ZONES for convenience.
const DEFAULT_CLOUD_ZONES =
  'amazon:us:ashburn,amazon:us:columbus,amazon:us:palo alto,' +
  'amazon:ca:montreal,amazon:ie:dublin,amazon:de:frankfurt,' +
  'amazon:gb:london,amazon:fr:paris,amazon:jp:tokyo,amazon:au:sydney';

const CLOUD_ZONES = (__ENV.CLOUD_ZONES || 'amazon:us:ashburn')
  .split(',')
  .map((z) => z.trim())
  .filter(Boolean);

const CLOUD_DISTRIBUTION = {};
CLOUD_ZONES.forEach((zone, i) => {
  // Even split; last zone absorbs the remainder so percents sum to 100.
  const base = Math.floor(100 / CLOUD_ZONES.length);
  const percent =
    i === CLOUD_ZONES.length - 1 ? 100 - base * (CLOUD_ZONES.length - 1) : base;
  CLOUD_DISTRIBUTION[`zone${i}`] = { loadZone: zone, percent };
});

export const options = {
  cloud: {
    name: `decision-read ${SLUG} (${TARGET_VUS}vu)`,
    projectID: __ENV.CLOUD_PROJECT_ID
      ? parseInt(__ENV.CLOUD_PROJECT_ID, 10)
      : undefined,
    distribution: CLOUD_DISTRIBUTION,
  },
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: TARGET_VUS },
        { duration: HOLD, target: TARGET_VUS },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    // Fail the run if more than 1% of requests are hard failures.
    http_req_failed: ['rate<0.01'],
    // SSR/RSC page render budgets — slower than API calls; tune to your SLOs.
    'http_req_duration{endpoint:page-process}': ['p(95)<3000'],
    'http_req_duration{endpoint:page-proposal}': ['p(95)<3000'],
    // Page GETs should return 200, not redirect to /login. A non-zero rate here
    // usually means anonymous public access is not actually enabled.
    page_redirected: ['rate<0.01'],
    // Per-endpoint latency budgets (server-side reads; tune to your SLOs).
    'http_req_duration{endpoint:getDecisionBySlug}': ['p(95)<800'],
    'http_req_duration{endpoint:getInstance}': ['p(95)<800'],
    'http_req_duration{endpoint:getCategories}': ['p(95)<600'],
    'http_req_duration{endpoint:listProposals}': ['p(95)<1200'],
    'http_req_duration{endpoint:getVotingStatus}': ['p(95)<600'],
    'http_req_duration{endpoint:getProposal}': ['p(95)<1200'],
    // Surface (but don't fail on) rate limiting — flip this if SPOOF_IP=false
    // and you expect the limiter to engage.
    rate_limited: ['rate<0.05'],
  },
};

// ---- helpers ----------------------------------------------------------------

// Deterministic, unique-per-VU IP so each virtual user is a distinct visitor
// to the rate limiter. __VU is 1-based and stable for the VU's lifetime.
function vuIp() {
  const v = __VU;
  return `10.${Math.floor(v / 65536) % 256}.${Math.floor(v / 256) % 256}.${v % 256}`;
}

function baseHeaders() {
  const h = { Accept: 'application/json' };
  if (SPOOF_IP) {
    h['X-Forwarded-For'] = vuIp();
  }
  return h;
}

// GET a Next.js page (HTML). Redirects are NOT followed: a 30x (e.g. to
// /login) means anonymous access isn't available and is counted as a failure,
// rather than silently "passing" by loading the redirect target.
function pageGet(path, endpoint) {
  const res = http.get(`${APP_URL}${path}`, {
    headers: baseHeaders(),
    redirects: 0,
    tags: { endpoint, name: endpoint },
  });

  const redirected = res.status >= 300 && res.status < 400;
  pageRedirected.add(redirected);

  check(res, {
    [`${endpoint} status 200`]: (r) => r.status === 200,
    [`${endpoint} not redirected`]: () => !redirected,
  });

  return res;
}

// Build a tRPC single-query GET URL. The server uses the superjson transformer,
// so the input is wrapped as {"json": <value>}.
function trpcUrl(procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  return `${BASE_URL}/${procedure}?input=${encoded}`;
}

// Run one tRPC query. Returns the deserialized result payload, or null on error.
function query(procedure, input) {
  // Tag with the bare procedure name (no `decision.` prefix) so it matches the
  // per-endpoint threshold keys below.
  const ep = procedure.replace(/^decision\./, '');
  const res = http.get(trpcUrl(procedure, input), {
    headers: baseHeaders(),
    tags: { endpoint: ep, name: ep },
  });

  const is429 = res.status === 429;
  rateLimited.add(is429);

  check(res, {
    [`${procedure} not rate limited`]: () => !is429,
    [`${procedure} status 200`]: (r) => r.status === 200,
  });

  if (res.status !== 200) {
    return null;
  }

  let body;
  try {
    body = JSON.parse(res.body);
  } catch (_e) {
    trpcErrors.add(1, { endpoint: procedure });
    return null;
  }

  // tRPC error envelope (single call): { error: { json: {...} } }
  if (body && body.error) {
    trpcErrors.add(1, { endpoint: procedure });
    return null;
  }

  // Success envelope: { result: { data: { json: <value> } } }. This API wraps
  // every payload once more as { _data, _meta }, so unwrap _data when present.
  const json =
    body && body.result && body.result.data ? body.result.data.json : null;
  if (json && typeof json === 'object' && '_data' in json) {
    return json._data;
  }
  return json;
}

function think() {
  sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- setup: validate config + resolve the process once ----------------------
export function setup() {
  if (!BASE_URL || !SLUG) {
    fail(
      'BASE_URL and SLUG are required, e.g. ' +
        '-e BASE_URL=https://api.../api/v1/trpc -e SLUG=my-decision',
    );
  }
  if (!SKIP_PAGES && !APP_URL) {
    fail(
      'APP_URL is required for page GETs (e.g. -e APP_URL=https://app-dev.oneproject.tech). ' +
        'Pass -e SKIP_PAGES=true to test the API only.',
    );
  }

  const profile = query('decision.getDecisionBySlug', { slug: SLUG });
  const instanceId =
    profile && profile.processInstance && profile.processInstance.id;

  if (!instanceId) {
    fail(
      `Could not resolve a process instance for slug "${SLUG}" at ${BASE_URL}. ` +
        'Check the slug, the base URL (should end in /api/v1/trpc), and that ' +
        'the process is publicly readable.',
    );
  }
  console.log(`Resolved slug "${SLUG}" -> instanceId ${instanceId}`);

  // Smoke-check the process page: warn loudly (don't abort) if an anonymous
  // visitor is redirected, since that makes the page metrics meaningless.
  if (!SKIP_PAGES) {
    const path = `/${LOCALE}/decisions/${SLUG}`;
    const res = http.get(`${APP_URL}${path}`, {
      headers: baseHeaders(),
      redirects: 0,
    });
    if (res.status !== 200) {
      console.warn(
        `WARNING: GET ${path} returned ${res.status}` +
          (res.headers['Location']
            ? ` -> ${res.headers['Location']}`
            : '') +
          '. Anonymous public access may not be enabled — page metrics will ' +
          'reflect the redirect target, not the decision page.',
      );
    } else {
      console.log(`Process page reachable anonymously: ${path}`);
    }
  }

  return { instanceId };
}

// ---- main VU flow ------------------------------------------------------------
export default function (data) {
  const instanceId = data.instanceId;
  let proposalProfileIds = [];

  // 1. Land on the process page. The browser first GETs the SSR/RSC page, then
  //    after hydration fires the client-side tRPC suspense queries below.
  group('view process', function () {
    if (!SKIP_PAGES) {
      pageGet(`/${LOCALE}/decisions/${SLUG}`, 'page-process');
    }

    query('decision.getDecisionBySlug', { slug: SLUG });
    query('decision.getInstance', { instanceId });
    query('decision.getCategories', { processInstanceId: instanceId });

    const list = query('decision.listProposals', {
      processInstanceId: instanceId,
      limit: LIST_LIMIT,
    });
    if (list && Array.isArray(list.proposals)) {
      proposalProfileIds = list.proposals
        .map((p) => p.profileId)
        .filter(Boolean);
    }

    query('decision.getVotingStatus', { processInstanceId: instanceId });
  });

  think();

  // 2. Open a proposal or two (some visitors only browse the list).
  if (proposalProfileIds.length > 0 && Math.random() < PROPOSAL_VIEW_PROB) {
    const views = 1 + Math.floor(Math.random() * MAX_PROPOSALS);
    for (let i = 0; i < views; i++) {
      const profileId = pickRandom(proposalProfileIds);
      group('view proposal', function () {
        if (!SKIP_PAGES) {
          pageGet(
            `/${LOCALE}/decisions/${SLUG}/proposal/${profileId}`,
            'page-proposal',
          );
        }
        query('decision.getProposal', { profileId });
      });
      think();
    }
  }
}
