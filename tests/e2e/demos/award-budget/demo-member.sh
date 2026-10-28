#!/usr/bin/env bash
set -euo pipefail
export AGENT_BROWSER_DEFAULT_TIMEOUT="${AGENT_BROWSER_DEFAULT_TIMEOUT:-90000}"

S="$(cd "$(dirname "$0")" && pwd)"
LABEL="${1:-member}"
BUDGET="${BUDGET:-12000}"

echo "→ seeding a hidden-budget decision…"
SEED_LABEL="$LABEL-member"
"$S/seed.sh" "$SEED_LABEL" "$BUDGET" true >/dev/null
SEED="$S/seed-$SEED_LABEL.json"
field() { node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(process.argv[2].split(".").reduce((o,k)=>o?.[k], s) ?? "")' "$SEED" "$1"; }
INSTANCE_ID="$(field instance.id)"
PASSWORD="$(field password)"
echo "instance: $(field instance.slug)  hideBudget: $(field hideBudget)  budget: $(field processBudget)"

phases_for() {
  local who="$1" email="$2"
  local token
  token="$(node "$S/session.ts" "$email" "$PASSWORD" "$LABEL-$who" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).accessToken))')"
  local cookie_file="$S/cookies-$LABEL-$who.json"
  local cookie
  cookie="$(node -e 'const c=require(process.argv[1]);console.log(c.map(x=>x.name+"="+x.value).join("; "))' "$cookie_file")"
  local input
  input="$(node -e 'console.log(encodeURIComponent(JSON.stringify({0:{json:{instanceId:process.argv[1]}}})))' "$INSTANCE_ID")"
  curl -s --max-time 30 -H "Cookie: $cookie" -H "Origin: http://localhost:3100" \
    "http://localhost:3300/api/v1/trpc/decision.getInstance?batch=1&input=$input" \
    | node -e '
      let d = ""; process.stdin.on("data", (c) => (d += c)).on("end", () => {
        const body = JSON.parse(d)[0];
        if (body.error) { console.log(`${process.argv[1]}: error ${body.error.json?.message ?? JSON.stringify(body.error)}`); return; }
        const data = body.result.data.json._data ?? body.result.data.json;
        const phases = (data.instanceData?.phases ?? []).map((p) => `${p.phaseId}=${JSON.stringify(p.settings ?? null)}`).join(" ; ");
        console.log(`${process.argv[1]} (admin=${data.access?.admin}): ${phases}`);
      });' "$who"
}

echo
echo "getInstance phase settings by viewer:"
phases_for admin "$(field admin.email)"
phases_for member "$(field member.email)"
echo
echo "Clean up with: just cleanup $LABEL"
