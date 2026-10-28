#!/usr/bin/env bash
set -euo pipefail
export AGENT_BROWSER_DEFAULT_TIMEOUT="${AGENT_BROWSER_DEFAULT_TIMEOUT:-90000}"

S="$(cd "$(dirname "$0")" && pwd)"
LABEL="${1:-main}"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
BUDGET="${BUDGET:-12000}"

echo "Served on :3100 right now: $(git -C "$S" log -1 --format='%h %s' 2>&- || echo unknown) ($(git -C "$S" rev-parse --abbrev-ref HEAD 2>&-))"
echo

# ── 1. Builder: no Total budget field, no hide toggle ──────────────────────
USER_JSON="$(node "$S/mkuser.ts" "$LABEL" | tail -1)"
EMAIL="$(node -e 'console.log(JSON.parse(process.argv[1]).email)' "$USER_JSON")"
USER_ID="$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$USER_JSON")"
psql "$DB" -At -c "update users set onboarded_at = now(), tos_accepted_on = now(), privacy_accepted_on = now() where auth_user_id = '$USER_ID'" >/dev/null
node -e '
const fs = require("fs");
const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
fs.writeFileSync(process.argv[2], JSON.stringify(s.cookies.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }))));
' "$S/session-$LABEL.json" "$S/cookies-$LABEL.json"
echo "builder user: $EMAIL"

echo "→ opening the browser…"
agent-browser close --all >/dev/null 2>&1 || true
agent-browser --headed open >/dev/null

cat > "$S/batch-$LABEL-builder.json" <<JSON
[
  ["set", "viewport", "1440", "760"],
  ["cookies", "set", "--curl", "$S/cookies-$LABEL.json", "--domain", "localhost"],
  ["open", "http://localhost:3100/en/"],
  ["wait", "--text", "Welcome back"],
  ["find", "role", "button", "click", "--name", "Create"],
  ["wait", "1500"],
  ["find", "testid", "create-decision-process", "click"],
  ["wait", "--url", "**/decisions/*/edit*"],
  ["wait", "--text", "Process Settings"],
  ["get", "url"],
  ["eval", "'Total budget field present: ' + [...document.querySelectorAll('label')].some(l => l.textContent.trim() === 'Total budget')"],
  ["eval", "'Hide budget switch present: ' + [...document.querySelectorAll('[role=switch]')].some(s => (s.getAttribute('aria-label') ?? s.closest('div')?.textContent ?? '').includes('Hide the total budget'))"],
  ["screenshot", "$S/main-1-builder-settings.png"]
]
JSON

print_batch() {
  node -e '
const rows = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const r of rows) {
  const cmd = Array.isArray(r.command) ? r.command.join(" ") : JSON.stringify(r.command ?? r.index);
  const { lifecycle, ...data } = r.result ?? {};
  const out = r.error ? `ERROR ${r.error}` : Object.keys(data).length === 0 ? "ok" : JSON.stringify(data);
  const shown = r.command?.[0] === "eval" && typeof data.result === "string" ? data.result : String(out).slice(0, 140);
  console.log(`${r.success === false || r.error ? "✗" : "✓"} ${cmd.slice(0, 90)} -> ${shown}`);
}
' "$1"
}

echo "→ builder: creating a draft and looking for the budget controls…"
agent-browser batch --bail --json < "$S/batch-$LABEL-builder.json" > "$S/batch-$LABEL-builder.result.json" || true
print_batch "$S/batch-$LABEL-builder.result.json"
SLUG="$(node -e 'const rows=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const u=rows.find(r=>r.command?.[0]==="get")?.result?.url ?? ""; console.log((u.match(/decisions\/([^/]+)\/edit/)||[])[1] ?? "")' "$S/batch-$LABEL-builder.result.json")"
echo "$SLUG" > "$S/draft-$LABEL.slug"
echo

# ── 2. Selection table: awards live in the confirm dialog, no budget bar ───
echo "→ seeding a final-phase decision with four proposals…"
"$S/seed.sh" "$LABEL" "$BUDGET" false >/dev/null
SEED="$S/seed-$LABEL.json"
field() { node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(process.argv[2].split(".").reduce((o,k)=>o?.[k], s) ?? "")' "$SEED" "$1"; }
ADMIN_EMAIL="$(field admin.email)"
PASSWORD="$(field password)"
INSTANCE_SLUG="$(field instance.slug)"
INSTANCE_ID="$(field instance.id)"
# The factory on the before branch has no phaseSettings option; write the budget directly so the member check below is meaningful.
psql "$DB" -At -c "update decision_process_instances set instance_data = jsonb_set(instance_data, '{phases}', (select jsonb_agg(case when p->>'phaseId' = 'final' then jsonb_set(p, '{settings}', coalesce(p->'settings', '{}'::jsonb) || jsonb_build_object('budget', $BUDGET)) else p end) from jsonb_array_elements(instance_data->'phases') p)) where id = '$INSTANCE_ID'" >/dev/null
echo "admin: $ADMIN_EMAIL  instance: $INSTANCE_SLUG"
node "$S/session.ts" "$ADMIN_EMAIL" "$PASSWORD" "$LABEL-admin" >/dev/null

cat > "$S/batch-$LABEL-selection.json" <<JSON
[
  ["cookies", "clear"],
  ["cookies", "set", "--curl", "$S/cookies-$LABEL-admin.json", "--domain", "localhost"],
  ["open", "http://localhost:3100/en/decisions/$INSTANCE_SLUG/current"],
  ["wait", "--text", "Confirm winning proposals"],
  ["eval", "'Award column in the table: ' + [...document.querySelectorAll('th')].some(th => th.textContent.trim() === 'Award')"],
  ["screenshot", "$S/main-2-table.png"],
  ["find", "role", "button", "click", "--name", "Advance Proposal Alpha"],
  ["find", "role", "button", "click", "--name", "Advance Proposal Beta"],
  ["wait", "--text", "2 winning proposals selected"],
  ["wait", "1500"],
  ["eval", "'Budget bar in the footer: ' + document.body.innerText.includes('allocated')"],
  ["screenshot", "$S/main-3-two-selected.png"],
  ["find", "role", "button", "click", "--name", "Confirm winning proposals"],
  ["wait", "--text", "Adjust amounts"],
  ["eval", "'Awards shown in the dialog: ' + [...document.querySelectorAll('[role=dialog] *')].filter(e => e.childElementCount === 0 && /Awarded/.test(e.textContent)).map(e => e.textContent.trim()).join(', ')"],
  ["screenshot", "$S/main-4-dialog-amounts.png"],
  ["find", "role", "button", "click", "--name", "Adjust amounts"],
  ["wait", "--text", "Awarded amount"],
  ["eval", "'Editable award fields in the dialog: ' + document.querySelectorAll('[role=dialog] input').length"],
  ["screenshot", "$S/main-5-dialog-adjusting.png"],
  ["find", "role", "button", "click", "--name", "Continue"],
  ["wait", "--text", "Not advanced"],
  ["find", "role", "button", "click", "--name", "Advance without notifying"],
  ["wait", "--text", "Results are live"],
  ["screenshot", "$S/main-6-results.png"]
]
JSON

echo "→ driving the selection table and the confirm dialog (about 90 s; results print when the batch ends)…"
agent-browser batch --bail --json < "$S/batch-$LABEL-selection.json" > "$S/batch-$LABEL-selection.result.json" || true
print_batch "$S/batch-$LABEL-selection.result.json"
echo
echo "Allocations stored for the latest result row:"
psql "$DB" -At -F ' | ' -c "select p.proposal_data->>'title', s.allocated from decision_process_result_selections s join decision_process_results r on r.id = s.process_result_id join decision_proposals p on p.id = s.proposal_id where r.process_instance_id = '$INSTANCE_ID' and r.executed_at = (select max(executed_at) from decision_process_results where process_instance_id = '$INSTANCE_ID') order by 1"
echo

# ── 3. Member view: getInstance drops the budget for the admin too ─────────
phases_for() {
  local who="$1" email="$2"
  node "$S/session.ts" "$email" "$PASSWORD" "$LABEL-$who" >/dev/null
  local cookie
  cookie="$(node -e 'const c=require(process.argv[1]);console.log(c.map(x=>x.name+"="+x.value).join("; "))' "$S/cookies-$LABEL-$who.json")"
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
psql "$DB" -At -c "update decision_process_instances set instance_data = jsonb_set(jsonb_set(instance_data, '{config}', coalesce(instance_data->'config', '{}'::jsonb), true), '{config,hideBudget}', 'true'::jsonb, true) where id = '$INSTANCE_ID'" >/dev/null
echo "getInstance phase settings with hideBudget on (budget $BUDGET stored on the final phase):"
phases_for admin "$ADMIN_EMAIL"
phases_for member "$(field member.email)"
echo
echo "Browser left open on the results page. Clean up with: just cleanup $LABEL"
