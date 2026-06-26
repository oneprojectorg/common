# RUNBOOK — decision-process read load test

Operational guide for running the public read load test against the decision
process. Written so another agent/operator can execute it cold. For *what the
script does and why*, see `README.md`; this is the "how to run it on the day".

---

## 0. Pre-flight (go / no-go)

- [ ] **k6 installed.** `k6 version` should print v2.x. If not: `brew install k6`.
- [ ] **Where are you running?** Two paths: **local** `run.sh` (§1) for quick
      smoke runs + live dashboard, or **Grafana Cloud** `k6 cloud run` (§7) for
      capacity runs (the current default for anything beyond a smoke test). Cloud
      needs a one-time `k6 cloud login` to the `hopefulbunting2650` stack.
- [ ] **Target is STAGING, not prod.** Defaults point at `app-dev` / `api-dev`.
      Do **not** retarget production without explicit human approval — this
      generates real traffic.
- [ ] **DB tier / pooler matches prod?** ⚠️ The single biggest caveat. If staging
      Supabase is a smaller tier, or the API isn't on the **transaction-mode
      pooler (port 6543)**, the numbers will NOT transfer to launch day. Confirm
      before trusting results. (Connection exhaustion is the expected first
      bottleneck under load.)
- [ ] **API is warm.** Baseline below was measured warm; a cold first run inflates
      latency. Do a short `TARGET_VUS=5 HOLD=20s` warm-up if unsure.
- [ ] **⛔ Rate limiter bypassed for the test.** REQUIRED for a single-machine run
      AND for free-tier cloud runs (one zone = one IP) — see §6. Without it the
      test collapses into one rate-limit bucket and measures `429`s, not capacity.
      **As of 2026-06-26 rate limiting is disabled on staging**, so single-IP runs
      currently measure real capacity — but re-confirm `rate_limited` ≈ 0 in the
      run, since a staging redeploy can drop the bypass.

## 1. The standard 300-VU run (watch dashboard live)

The live dashboard only exists **while k6 runs**, so run it in the background and
open the dashboard during the ~4.5 min window. A self-contained HTML report is
written at the end regardless.

```sh
cd /Users/valentino/oneprojectorg/common/load-test
# background the run, then open the dashboard
load-tests/run.sh    # run this with run_in_background=true (agent) or `&` + open browser (human)
```

- **Live dashboard:** http://localhost:5665 (time-series: VUs, req/s, latency)
- **HTML report:** `load-tests/report-300vu-<timestamp>.html` written on completion
  (skipped only for runs <~20s)
- Profile (default): ramp `1m` → 300 VUs, hold `3m`, ramp down `30s`.

If you're an agent driving via the Bash tool: launch `run.sh` with
`run_in_background: true` so the call returns immediately and k6 keeps running;
the dashboard is then reachable for the duration. Poll the run / tail output to
know when it finishes, then read the HTML report path from the final output.

## 2. Other profiles

```sh
TARGET_VUS=50 load-tests/run.sh                                  # smaller smoke
LABEL=spike RAMP_UP=15s TARGET_VUS=1000 HOLD=2m load-tests/run.sh # launch thundering-herd
JSON_OUT=1 load-tests/run.sh                                     # + per-sample JSON (large)
load-tests/run.sh -e SKIP_PAGES=true                            # API only, no SSR page GETs
```

Override target via env: `APP_URL`, `BASE_URL` (must end `/api/v1/trpc`), `SLUG`.

## 3. What to watch / how to read it

| Signal | Healthy | If it goes wrong |
| --- | --- | --- |
| `http_req_failed` | <1% (threshold) | 5xx/timeouts — backend saturating |
| `rate_limited` | **~0%** | On staging the per-VU XFF trick does NOT work (proxy strips it — see §6). If this is >0, the limiter is NOT bypassed and results are limiter-bound, not capacity — stop and fix §6 before trusting anything |
| `page_redirected` | **0%** | >0 means anon access broke / redirect to `/login` — page metrics are meaningless |
| `http_req_duration{endpoint:listProposals}` | watch closely | heaviest query; first to bend under load |
| `http_req_duration{endpoint:page-process}` | SSR render path | bends if Next.js/server is the bottleneck vs. DB |

**Method:** climb, don't open at the ceiling. 300 → find where p95 bends → then
push toward the spike profile. A failed threshold makes k6 exit non-zero.

## 4. Known facts (verified 2026-06-22 against staging)

- **Anonymous public access IS live** on slug `staging-commonville-pb-f2f67c2d`
  (process page returns 200 anonymously; all read procedures are public
  `openProcedure`).
- **Rate limiter:** in-memory `Map`, keyed `${X-Forwarded-For}-${url}`, default
  10 req/10s (`getDecisionBySlug` 20, `getInstance` 30). Per-process, not Redis.
  Bypassed when `process.env.E2E` is set or for SSR-internal calls
  (`ctx.isServerSideCall`, not settable by an external client).
- **⚠️ The per-VU `X-Forwarded-For` trick does NOT work on staging.** Verified
  2026-06-22: sending a unique XFF per request still collapses to one bucket
  (18 reqs → 10×200 + 8×429, same with unique vs. fixed XFF). The Vercel proxy
  overwrites the client XFF with the real connecting IP before the app sees it,
  so all load from one machine shares one bucket. Consequence: a single-box run
  MUST bypass the limiter server-side (§6) or use many real IPs.
- **Response envelope:** payloads are `result.data.json._data` (extra `_data`
  wrapper). The script already unwraps this — don't "fix" it.
- **Locale:** `localePrefix: 'always'`, so page URLs need `/en/...`.
- **Two origins:** app `app-dev.oneproject.tech`; API
  `api-dev.oneproject.tech/api/v1/trpc`. Prod (do not target without approval):
  `common.oneproject.org` / `api-common.oneproject.org`.

### Baseline (2 VUs, near-idle — p95)

| endpoint | p95 | | endpoint | p95 |
| --- | --- | --- | --- | --- |
| getVotingStatus | ~420ms | | getProposal | ~527ms |
| getCategories | ~460ms | | **listProposals** | **~720ms** |
| getInstance | ~520ms | | page-process (SSR) | ~1.0s |
| getDecisionBySlug | ~535ms | | page-proposal (SSR) | ~680ms |

~400–500ms per call even at idle is the floor; that's the number to compare
against under load.

### Cloud capacity run (100 VUs, Grafana Cloud, 2026-06-26)

First Grafana Cloud run with rate limiting disabled on staging
([run 7891884](https://hopefulbunting2650.grafana.net/a/k6-app/runs/7891884)):
single zone (Ashburn), ramp 30s → 100 VUs, hold 1m, down 20s.

- **11/11 thresholds passed**, **17.3K/17.3K checks (100%)**, **0 failures**.
- `rate_limited` = 0 (bypass confirmed), `page_redirected` = 0 (anon access OK).
- ~1.1K requests/endpoint (getProposal/page-proposal ~966), all 100% success.

Conclusion: staging absorbed 100 concurrent VUs with full headroom — no errors,
no latency-threshold breaches. Next step to find the bend is 300 VUs, which needs
the free-tier 100-VU cap lifted first (§7).

## 6. Getting past the rate limiter (REQUIRED for single-box runs)

> **Status 2026-06-26: rate limiting is DISABLED on the staging API** (option 1
> below is in effect). Single-IP runs — including free-tier Grafana Cloud runs
> from one zone (§7) — currently measure real capacity, not the limiter. Verified
> by `rate_limited` = 0 in the 100-VU cloud run. If staging is redeployed and the
> bypass is dropped, re-confirm before trusting single-IP numbers.

Why this matters: in production, thousands of real users each have a distinct
IP, so the per-IP 10/10s limit won't bind for normal browsing — the limiter is
NOT the prod bottleneck for legit traffic. But a load test from one machine is
one IP, so the limiter binds immediately and you'd measure it instead of the
backend. To measure real capacity you must take the limiter out of the picture.

Options, best first:

1. **Set `E2E` on the staging API process (recommended).** `withRateLimited`
   bypasses entirely when `process.env.E2E` is truthy. This is an env/redeploy
   change on the staging API (e.g. a Vercel env var) — needs someone with deploy
   access; it can't be done from the load-test side. Pro: clean backend-capacity
   numbers, no extra infra. Con: you're testing with the limiter off (fine for a
   capacity test; do a separate small run with it on to validate the limiter).
2. **Generate load from many real IPs** — k6 Cloud or several machines/agents.
   Most faithful (mirrors distinct-IP users) but costs / setup. No server change.
3. **Temporarily raise the limits in code** for the test window (bump
   `DEFAULT_RATE_LIMIT` / per-procedure limits) and redeploy. Code change; least
   preferred.

Do NOT just set `SPOOF_IP=false` and "accept" the limiter — that only measures
how fast one IP gets throttled, which tells you nothing about launch capacity.

After bypassing, sanity-check: `rate_limited` should be ~0% in the run. If it's
not, the bypass didn't take effect — stop and fix before trusting results.

## 7. Running in Grafana Cloud k6 (current default for big runs)

We now run load from **Grafana Cloud k6** rather than a single laptop. This runs
the **same** `decision-read.js` unchanged from distributed cloud load
generators, streaming results to a Grafana dashboard (no local
`report-*.html`). Use it for any multi-VU capacity run; keep local `run.sh`
(§1) for quick smoke checks and the live dashboard.

### Account / stack

- **Stack:** `hopefulbunting2650` (`https://hopefulbunting2650.grafana.net`)
- **k6 app:** Grafana → **Testing & synthetics → Performance**
- **Plan:** Grafana Cloud **Free / trial** as of 2026-06-26 (see caps below)
- **Default project ID:** `7931096`

### One-time auth

```sh
k6 cloud login
#   Token: <k6 personal API token — Performance → Settings → Personal API token>
#   Stack: hopefulbunting2650      # MUST match the URL slug, not "oneprojectorg-common"
```

Credentials are saved to `~/Library/Application Support/k6/config.json`.

### Run

```sh
k6 cloud run \
  -e APP_URL=https://app-dev.oneproject.tech \
  -e BASE_URL=https://api-dev.oneproject.tech/api/v1/trpc \
  -e SLUG=staging-commonville-pb-f2f67c2d \
  -e TARGET_VUS=100 -e RAMP_UP=30s -e HOLD=1m -e RAMP_DOWN=20s \
  load-tests/decision-read.js
```

The CLI prints a run URL (`.../a/k6-app/runs/<id>`) and only streams progress —
**read the actual numbers in the dashboard** (Thresholds / Checks / per-endpoint
tabs). The "Performance Overview" chart often says *"No data recorded"* on short
runs; that's cosmetic — the Thresholds/Checks tabs still have the real data.

### ⚠️ Free-tier caps (verified 2026-06-26)

- **Max 100 VUs per test.** 300 VUs is rejected outright
  (`exceeds the maximum allowed for your project (100 VUs)`). To go higher, an
  admin must raise the project VU limit or upgrade the plan.
- **Max 1 load zone.** A 10-zone distribution is rejected
  (`Requested number of load zones not allowed (10 > max of 1)`). So free-tier
  runs come from **one zone = one source IP**.
- ~500 VU-hours/month free (a 100-VU ~3-min run ≈ 2.6 VUh).

### Load zones (`CLOUD_ZONES`)

The script builds `cloud.distribution` from the `CLOUD_ZONES` env var
(comma-separated), splitting VUs evenly. Default is a **single** zone
(`amazon:us:ashburn`) so free-tier runs validate. On a paid plan, widen it:

```sh
CLOUD_ZONES="amazon:us:ashburn,amazon:ie:dublin,amazon:jp:tokyo" \
TARGET_VUS=300 k6 cloud run ... load-tests/decision-read.js
```

`DEFAULT_CLOUD_ZONES` in the script lists the full ~10-zone set to copy from.

### Rate limiting + the cloud

On the free tier you're stuck on **one IP** (single zone), so the per-IP limiter
would normally bind hard. We currently sidestep this because **rate limiting is
disabled on the staging API** (§6) — confirmed by `rate_limited` = 0 in the
2026-06-26 100-VU run. If the limiter is ever re-enabled, a single-zone cloud run
will be limiter-bound just like a single laptop; you'd then need a paid plan with
multiple zones (more IPs) or keep the §6 bypass.

## 5. Cleanup

Generated `report-*.html` / `results-*.json` are gitignored. Delete old ones
freely; keep the ones you want to compare across runs (they're timestamped).
