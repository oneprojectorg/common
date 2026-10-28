#!/usr/bin/env bash
set -euo pipefail
export AGENT_BROWSER_DEFAULT_TIMEOUT="${AGENT_BROWSER_DEFAULT_TIMEOUT:-90000}"

S="$(cd "$(dirname "$0")" && pwd)"
LABEL="${1:-selection}"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
BUDGET="${BUDGET:-12000}"

echo "→ seeding a final-phase decision with four proposals (budget $BUDGET)…"
"$S/seed.sh" "$LABEL" "$BUDGET" "${HIDE_BUDGET:-false}" >/dev/null
SEED="$S/seed-$LABEL.json"
ADMIN_EMAIL="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).admin.email)' "$SEED")"
PASSWORD="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).password)' "$SEED")"
SLUG="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).instance.slug)' "$SEED")"
INSTANCE_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).instance.id)' "$SEED")"
echo "admin: $ADMIN_EMAIL  instance: $SLUG"

node "$S/session.ts" "$ADMIN_EMAIL" "$PASSWORD" "$LABEL" >/dev/null

echo "→ opening the browser…"
agent-browser close --all >/dev/null 2>&1 || true
agent-browser --headed open >/dev/null

cat > "$S/batch-$LABEL.json" <<JSON
[
  ["set", "viewport", "1440", "900"],
  ["cookies", "set", "--curl", "$S/cookies-$LABEL.json", "--domain", "localhost"],
  ["open", "http://localhost:3100/en/decisions/$SLUG/current"],
  ["wait", "--text", "Confirm winning proposals"],
  ["screenshot", "$S/selection-1-table.png"],
  ["find", "role", "button", "click", "--name", "Advance Proposal Alpha"],
  ["find", "role", "button", "click", "--name", "Advance Proposal Beta"],
  ["wait", "--text", "Over budget by"],
  ["eval", "'confirm disabled over budget: ' + Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm winning proposals'))?.disabled"],
  ["wait", "1500"],
  ["screenshot", "$S/selection-2-over-budget.png"],
  ["find", "role", "button", "click", "--name", "Advance Proposal Euro"],
  ["wait", "--text", "more than one currency"],
  ["eval", "'confirm disabled mixed currency: ' + Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm winning proposals'))?.disabled"],
  ["wait", "1500"],
  ["screenshot", "$S/selection-3-mixed-currency.png"],
  ["find", "role", "button", "click", "--name", "Advance Proposal Euro"],
  ["wait", "--text", "Over budget by"],
  ["find", "label", "Award for Proposal Alpha", "fill", "0"],
  ["wait", "--text", "Enter an amount greater than 0"],
  ["screenshot", "$S/selection-4-empty-award.png"],
  ["find", "label", "Award for Proposal Alpha", "fill", "3000"],
  ["find", "label", "Award for Proposal Beta", "fill", "9000"],
  ["wait", "--text", "of \$12,000 allocated"],
  ["eval", "'confirm disabled within budget: ' + Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm winning proposals'))?.disabled"],
  ["screenshot", "$S/selection-5-within-budget.png"],
  ["find", "role", "button", "click", "--name", "Confirm winning proposals"],
  ["wait", "--text", "Awarded"],
  ["screenshot", "$S/selection-6-confirm-dialog.png"],
  ["find", "role", "button", "click", "--name", "Continue"],
  ["wait", "--text", "Not advanced"],
  ["find", "role", "button", "click", "--name", "Advance without notifying"],
  ["wait", "--text", "Results are live"],
  ["screenshot", "$S/selection-7-results.png"]
]
JSON

echo "→ driving the selection table (about 90 s; results print when the batch ends)…"
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

echo
echo "Allocations stored for the latest result row:"
psql "$DB" -At -F ' | ' -c "select p.proposal_data->>'title', s.allocated from decision_process_result_selections s join decision_process_results r on r.id = s.process_result_id join decision_proposals p on p.id = s.proposal_id where r.process_instance_id = '$INSTANCE_ID' and r.executed_at = (select max(executed_at) from decision_process_results where process_instance_id = '$INSTANCE_ID') order by 1"
echo
echo "Browser left open on the results page. Clean up with: just cleanup $LABEL"
