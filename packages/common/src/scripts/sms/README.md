# SMS voting demo scripts

Helpers for the local SMS voting demo. `run.sh` executes the SQL scripts
in this folder. It acts on the local database only: a `DATABASE_URL`
that is not localhost is refused unless `SMS_DEMO_ALLOW_REMOTE=1` is
set.

## Prerequisites

- `psql` on your PATH.
- `DATABASE_URL` in the environment, or in the repo's `.env.local`.
- `jq` for pretty JSON output (optional; raw JSON without it).

## Commands

```sh
packages/common/src/scripts/sms/run.sh <command> [argument]
```

| Command | What it does |
| --- | --- |
| `show [slug]` | Prints one decision's whole voting state as JSON: the decision, its chat line, the districts, and every voter's registration, draft and cast ballot. |
| `reset-decision [slug]` | Deletes every voter's registrations, drafts, chat sessions and cast ballots on one decision. Proposals, districts, access and the phone number stay. |
| `reset-account <phone>` | Deletes the account behind one phone number — the GoTrue user, its public rows and everything its individual profile owns — so `JOIN` starts from scratch. |
| `reset <phone> [slug]` | `reset-decision`, then `reset-account`, then `show`: the full demo reset. |

Default: `slug=sms-voting-test`. The phone number is always explicit —
pass the number you test with.

Examples:

```sh
packages/common/src/scripts/sms/run.sh show
packages/common/src/scripts/sms/run.sh reset-decision my-decision
packages/common/src/scripts/sms/run.sh reset-account +15555550123
packages/common/src/scripts/sms/run.sh reset +15555550123
```

## Notes

- Reset rows are hard-deleted: the unique keys on
  `(process_instance_id, profile_id)` would otherwise block a voter from
  registering again.
- To run a script directly, pass its `psql` variable yourself, e.g.
  `psql "$DATABASE_URL" -v slug=sms-voting-test -At -f packages/common/src/scripts/sms/describeDecisionProcess.sql | jq .`
  — each script's header shows its own usage line.
- The staging walkthrough that uses these scripts is in
  [`docs/twilio-configuration.md`](../../../../../docs/twilio-configuration.md)
  under "Manual test through ngrok".
