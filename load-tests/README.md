# Load tests (k6)

Load tests for the public-facing decision process surfaces.

## Install k6

```sh
brew install k6        # macOS
# or see https://grafana.com/docs/k6/latest/set-up/install-k6/
```

## `decision-read.js` — anonymous read paths

Simulates anonymous visitors browsing a public decision process under
`/decisions/<slug>`: landing on the process, then opening proposals. It
exercises **both** layers a real visitor hits:

1. the **Next.js page GET** (SSR/RSC render path), and
2. the **client-side tRPC queries** those pages fire after hydration.

| Step | request |
| --- | --- |
| Navigate to process | `GET /<locale>/decisions/<slug>` (HTML, SSR) |
| Resolve process by slug | `decision.getDecisionBySlug` `{ slug }` |
| Load instance | `decision.getInstance` `{ instanceId }` |
| Load categories | `decision.getCategories` `{ processInstanceId }` |
| List proposals | `decision.listProposals` `{ processInstanceId, limit }` |
| Voting status | `decision.getVotingStatus` `{ processInstanceId }` |
| Navigate to proposal | `GET /<locale>/decisions/<slug>/proposal/<profileId>` (HTML, SSR) |
| Open a proposal | `decision.getProposal` `{ profileId }` |

The flow bootstraps entirely from the slug — `getDecisionBySlug` returns
`processInstance.id`, and `listProposals` returns the `profileId`s used for the
proposal page URL and `getProposal`. You supply `APP_URL`, `BASE_URL`, `SLUG`.

> **App and API are separate origins.** `APP_URL` is the Next.js app
> (e.g. `https://app-dev.oneproject.tech`); `BASE_URL` is the tRPC base and must
> end in `/api/v1/trpc` (e.g. `https://api-dev.oneproject.tech/api/v1/trpc`).
> Production: app `https://common.oneproject.org`, api
> `https://api-common.oneproject.org/api/v1/trpc`.

> **Page redirects are not followed** (`redirects: 0`). A page GET that returns
> 30x (e.g. to `/login`) means anonymous public access isn't enabled — it's
> counted as a failure (`page_redirected` metric) instead of silently passing by
> loading the redirect target. `setup()` also smoke-checks the process page and
> warns loudly if it redirects.

> **SSR overlap caveat:** when Next.js server-renders the page it calls the API
> server-side, and those calls *bypass* the rate limiter (`ctx.isServerSideCall`).
> The explicit tRPC calls in this script model the *client-side* suspense queries
> that run after hydration, so there's some overlap with the SSR-internal fetches.
> Treat the page-GET latency as the render path and the tRPC latencies as the
> client refetch path. Use `SKIP_PAGES=true` to measure the API in isolation.

### Run (recommended: live dashboard)

`run.sh` wraps the env vars and enables k6's **live web dashboard**. While the
test runs, open **http://localhost:5665** for time-series charts; a
self-contained HTML report is written to `load-tests/report-<label>-<stamp>.html`
when it finishes.

```sh
load-tests/run.sh                          # 300-VU staged ramp (default target/profile)
TARGET_VUS=50 load-tests/run.sh            # smaller run
LABEL=spike RAMP_UP=15s TARGET_VUS=1000 HOLD=2m load-tests/run.sh
JSON_OUT=1 load-tests/run.sh               # also dump per-sample JSON (large)
load-tests/run.sh -e SKIP_PAGES=true       # extra k6 flags pass through
```

Targets default to staging (`app-dev` / `api-dev` / the Commonville PB slug);
override with `APP_URL`, `BASE_URL`, `SLUG`. Generated reports/JSON are
gitignored. Note: very short runs (<~20s) skip HTML report generation.

### Run (plain k6)

```sh
k6 run \
  -e APP_URL=https://app-dev.oneproject.tech \
  -e BASE_URL=https://api-dev.oneproject.tech/api/v1/trpc \
  -e SLUG=my-decision-slug \
  load-tests/decision-read.js
```

### Knobs

| env | default | meaning |
| --- | --- | --- |
| `TARGET_VUS` | `100` | peak concurrent virtual users |
| `RAMP_UP` / `HOLD` / `RAMP_DOWN` | `1m` / `3m` / `30s` | scenario stages |
| `LOCALE` | `en` | locale prefix for page URLs (`localePrefix: 'always'`) |
| `PROPOSAL_VIEW_PROB` | `0.6` | fraction of iterations that open proposals |
| `MAX_PROPOSALS` | `2` | proposals opened per browsing iteration |
| `THINK_MIN` / `THINK_MAX` | `1` / `4` | per-action think time (seconds) |
| `LIST_LIMIT` | `20` | proposals fetched per list call |
| `SPOOF_IP` | `true` | unique `X-Forwarded-For` per VU (see below) |
| `SKIP_PAGES` | `false` | `true` = test the API only, skip SSR page GETs |

## ⚠️ Rate limiting — read before trusting any numbers

Every public read endpoint is rate-limited in-memory, keyed on
`${X-Forwarded-For}-${url}` (`services/api/src/lib/rateLimited.ts`):

- defaults: **10 requests / 10s** per key (`getDecisionBySlug` 20, `getInstance` 30)
- the store is an **in-memory `Map`** — per-process, not Redis, resets on deploy,
  not shared across instances
- bypassed entirely when `process.env.E2E` is set or for server-side calls

Because the key includes the client IP, **running k6 from one machine means one
source IP** — without intervention all VUs share one bucket and you mostly
measure `429`s, not real capacity.

This script sets a **unique, stable `X-Forwarded-For` per VU** (`SPOOF_IP=true`,
the default). That both simulates distinct visitors and gives each VU its own
rate-limit budget, so you measure the actual backend (DB, API, render path).

Pick your intent:

- **Measure real capacity (recommended first):** keep `SPOOF_IP=true`. Best run
  against a staging env on the **same Supabase tier as prod** (DB connections /
  pooler are the usual first bottleneck — confirm the API talks to the
  transaction-mode pooler on port 6543, not a direct connection).
- **Measure the rate limiter as-is:** `-e SPOOF_IP=false`. Expect heavy `429`s
  from a single machine; the `rate_limited` metric tracks the share.

> Note: that the limiter trusts a raw client `X-Forwarded-For` is also a real
> production concern — a client can rotate the header to evade it. Tracked
> separately from load testing.

### Metrics

- `http_req_duration{endpoint:<name>}` — per-endpoint latency, with p95 thresholds
  (e.g. `endpoint:page-process`, `endpoint:getProposal`)
- `http_req_failed` — hard failure rate (threshold <1%)
- `page_redirected` — share of page GETs that returned a redirect (should be ~0)
- `rate_limited` — share of `429` responses
- `trpc_errors` — tRPC errors returned in a 200 body

## Scaling toward thousands

Thousands of *concurrent* VUs from one laptop is resource-heavy. Options:

- raise `TARGET_VUS` and run from a larger box (one VU ≈ one active visitor,
  given the built-in think time)
- distribute across machines or use **k6 Cloud** / multiple agents for true
  high-concurrency + many real source IPs
- a launch "thundering herd" (everyone clicks an email link at once) is better
  modeled with a short `RAMP_UP` and a high `TARGET_VUS`
