# Proposal short-code backfill

`submitProposal` assigns a proposal its short code at submission. Proposals
submitted before that code deployed have a null `short_code`, and the SMS
ballot cannot name them. The Inngest function `backfillProposalShortCodes`
assigns the missing codes, one decision instance per step.

The function lives in
`services/workflows/src/functions/decisions/backfillProposalShortCodes.ts`.
It numbers each instance's live, voting-eligible proposals (not draft,
rejected, duplicate, or moderation-detached) in creation order, starting
from the instance's `next_short_code`, under the same row lock
`submitProposal` takes. A re-run assigns nothing.

## Trigger in development

1. Start the API and the Inngest dev server:

   ```sh
   pnpm w:api dev
   pnpm w:workflows dev
   ```

2. Open http://localhost:8288. The dev server discovers the API's serve
   endpoint (`apps/api/app/api/v1/workflows/route.ts`) and lists
   `backfillProposalShortCodes` under Functions.

3. Send the event. Use the function's Invoke button, or Events → Send
   event with:

   ```json
   {
     "name": "decision/short-codes.backfill-requested",
     "data": {}
   }
   ```

   An empty `data` backfills every instance that needs codes. To scope the
   run to specific decisions:

   ```json
   {
     "name": "decision/short-codes.backfill-requested",
     "data": { "instanceIds": ["<instance uuid>"] }
   }
   ```

4. Open the run. The steps are `list-instances`, then one
   `backfill-<instanceId>` per decision; each step's output holds
   `assigned` and the instance's new `nextShortCode`. The final log line is
   `Proposal short-code backfill completed` with the totals.

## Trigger on staging or production

Same event, sent from the Inngest Cloud dashboard (app.inngest.com), in
the environment whose keys the Vercel project holds. The function appears
after the deployment that carries it syncs. Verify afterwards:

```sql
SELECT count(*) AS proposals_needing_short_code
FROM decision_proposals p
WHERE p.deleted_at IS NULL
  AND p.moderation_detached_at IS NULL
  AND p.status NOT IN ('draft', 'rejected', 'duplicate')
  AND p.short_code IS NULL;
```

Expect 0.

## SQL fallback

`packages/common/src/scripts/backfillProposalShortCodes.sql` does the same
work as one hand-run transaction, for an operator without Inngest access.
It locks every live instance for its duration; prefer the Inngest function.
