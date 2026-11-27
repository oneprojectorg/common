-- Settle every transition that settled under the old rule, an admin's
-- confirmation or attached proposals, before readers rely on
-- selection_confirmed_at alone. Rows the previous deployment wrote during
-- earlier rollouts are covered too; the rest still wait for a manual
-- selection and stay null.
UPDATE "decision_transition_history" AS h
SET "selection_confirmed_at" = COALESCE(
  (h."transition_data" -> 'manualSelection' ->> 'at')::timestamptz,
  h."transitioned_at"
)
WHERE h."selection_confirmed_at" IS NULL
  AND (
    h."transition_data" ? 'manualSelection'
    OR EXISTS (
      SELECT 1 FROM "decision_transition_proposals" AS p
      WHERE p."transition_history_id" = h."id"
    )
  );
