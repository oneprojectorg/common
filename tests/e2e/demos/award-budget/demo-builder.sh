#!/usr/bin/env bash
set -euo pipefail
export AGENT_BROWSER_DEFAULT_TIMEOUT="${AGENT_BROWSER_DEFAULT_TIMEOUT:-90000}"

S="$(cd "$(dirname "$0")" && pwd)"
LABEL="${1:-builder}"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
BUDGET="${BUDGET:-25000}"

USER_JSON="$(node "$S/mkuser.ts" "$LABEL" | tail -1)"
EMAIL="$(node -e 'console.log(JSON.parse(process.argv[1]).email)' "$USER_JSON")"
USER_ID="$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$USER_JSON")"
psql "$DB" -At -c "update users set onboarded_at = now(), tos_accepted_on = now(), privacy_accepted_on = now() where auth_user_id = '$USER_ID'" >/dev/null
node -e '
const fs = require("fs");
const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
fs.writeFileSync(process.argv[2], JSON.stringify(s.cookies.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }))));
' "$S/session-$LABEL.json" "$S/cookies-$LABEL.json"
echo "user: $EMAIL ($USER_ID)"

echo "→ opening the browser…"
agent-browser close --all >/dev/null 2>&1 || true
agent-browser --headed open >/dev/null

cat > "$S/batch-$LABEL.json" <<JSON
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
  ["find", "label", "Total budget", "fill", "$BUDGET"],
  ["wait", "--text", "Saved at"],
  ["find", "role", "switch", "click", "--name", "Hide the total budget from members"],
  ["wait", "2500"],
  ["screenshot", "$S/builder-1-budget-and-toggle.png"],
  ["reload"],
  ["wait", "--text", "Process Settings"],
  ["eval", "(l => 'Total budget after reload: ' + (l ? document.getElementById(l.htmlFor)?.value : 'no label'))([...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'Total budget'))"],
  ["eval", "'Hide budget after reload: ' + document.querySelector('[role=switch]')?.getAttribute('aria-checked')"],
  ["screenshot", "$S/builder-2-after-reload.png"]
]
JSON

echo "→ creating a draft process and setting its budget (about 30 s; results print when the batch ends)…"
agent-browser batch --bail --json < "$S/batch-$LABEL.json" > "$S/batch-$LABEL.result.json" || true
node -e '
const rows = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const r of rows) {
  const cmd = Array.isArray(r.command) ? r.command.join(" ") : JSON.stringify(r.command ?? r.index);
  const { lifecycle, ...data } = r.result ?? {};
  const out = r.error ? `ERROR ${r.error}` : Object.keys(data).length === 0 ? "ok" : JSON.stringify(data);
  const shown = r.command?.[0] === "eval" && typeof data.result === "string" ? data.result : String(out).slice(0, 140);
  console.log(`${r.success === false || r.error ? "✗" : "✓"} ${cmd.slice(0, 90)} -> ${shown}`);
}
' "$S/batch-$LABEL.result.json"

SLUG="$(node -e 'const rows=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const u=rows.find(r=>r.command?.[0]==="get")?.result?.url ?? ""; console.log((u.match(/decisions\/([^/]+)\/edit/)||[])[1] ?? "")' "$S/batch-$LABEL.result.json")"
echo
echo "Read-back from the local database (draft $SLUG):"
psql "$DB" -At -F ' | ' -c "select 'hideBudget=' || coalesce(i.instance_data->'config'->>'hideBudget','null'), (select string_agg(p->>'phaseId' || '=' || coalesce((p->'settings')::text,'-'), ' ; ') from jsonb_array_elements(i.instance_data->'phases') p) from decision_process_instances i join profiles pr on pr.id = i.profile_id where pr.slug = '$SLUG'"
echo "$SLUG" > "$S/draft-$LABEL.slug"
echo
echo "Browser left open on the builder. Clean up with: just cleanup $LABEL"
