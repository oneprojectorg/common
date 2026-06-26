#!/usr/bin/env bash
#
# Run the decision-read load test with k6's live web dashboard.
#
# While running: open http://localhost:5665 to watch time-series charts.
# At the end: a self-contained HTML report is written to load-tests/.
#
# Usage:
#   load-tests/run.sh                      # 300-VU staged ramp (default)
#   TARGET_VUS=50 load-tests/run.sh        # smaller run
#   LABEL=spike RAMP_UP=15s TARGET_VUS=1000 HOLD=2m load-tests/run.sh
#   JSON_OUT=1 load-tests/run.sh           # also dump per-sample JSON (large)
#   load-tests/run.sh -e SKIP_PAGES=true   # extra k6 flags pass through
#
set -euo pipefail

# --- target (override via env) ---
APP_URL="${APP_URL:-https://app-dev.oneproject.tech}"
BASE_URL="${BASE_URL:-https://api-dev.oneproject.tech/api/v1/trpc}"
SLUG="${SLUG:-staging-commonville-pb-f2f67c2d}"

# --- load profile (override via env) ---
TARGET_VUS="${TARGET_VUS:-300}"
RAMP_UP="${RAMP_UP:-1m}"
HOLD="${HOLD:-3m}"
RAMP_DOWN="${RAMP_DOWN:-30s}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="${LABEL:-${TARGET_VUS}vu}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="${DIR}/report-${LABEL}-${STAMP}.html"

# Optional per-sample JSON export (hundreds of MB on big runs).
JSON_ARGS=()
if [[ "${JSON_OUT:-0}" == "1" ]]; then
  JSON_ARGS=(--out "json=${DIR}/results-${LABEL}-${STAMP}.json")
fi

echo "Live dashboard:  http://localhost:5665"
echo "HTML report ->   ${REPORT}"
echo "Profile:         ramp ${RAMP_UP} -> ${TARGET_VUS} VUs, hold ${HOLD}, down ${RAMP_DOWN}"
echo

K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT="${REPORT}" \
k6 run \
  -e APP_URL="${APP_URL}" \
  -e BASE_URL="${BASE_URL}" \
  -e SLUG="${SLUG}" \
  -e TARGET_VUS="${TARGET_VUS}" \
  -e RAMP_UP="${RAMP_UP}" \
  -e HOLD="${HOLD}" \
  -e RAMP_DOWN="${RAMP_DOWN}" \
  "${JSON_ARGS[@]}" \
  "$@" \
  "${DIR}/decision-read.js"

echo
echo "Done. Open the report: ${REPORT}"
