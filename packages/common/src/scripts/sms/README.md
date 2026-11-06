# SMS voting demo scripts

Helpers for the local SMS voting demo. Each script reads one `psql`
variable and acts on the local database only. Never run them against a
shared environment.

## Prerequisites

- `psql` on your PATH.
- `DATABASE_URL` in the repo's `.env.local`.
- `jq` for the describe script's JSON output.

The commands below read the URL from `.env.local`:

```sh
DB="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
```

## Show a decision

Prints one decision's whole voting state as JSON: the decision, its chat
line, the districts, and every voter's registration, draft and cast
ballot.

```sh
psql "$DB" -v slug=sms-voting-test -At \
  -f packages/common/src/scripts/sms/describeDecisionProcess.sql | jq .
```

## Reset a decision

Deletes every voter's registrations, drafts, chat sessions and cast
ballots on one decision. Proposals, districts, access and the phone
number stay. Rows are hard-deleted because the unique keys on
`(process_instance_id, profile_id)` would block a voter from
registering again.

```sh
psql "$DB" -v slug=sms-voting-test -At \
  -f packages/common/src/scripts/sms/resetDecisionVoting.sql
```

## Reset an account

Deletes the account behind one phone number — the GoTrue user, its
public rows and everything its individual profile owns — so `JOIN`
starts from scratch.

```sh
psql "$DB" -v phone=+15555550123 -At \
  -f packages/common/src/scripts/sms/resetSmsAccount.sql
```

## Full demo reset

Reset the decision, reset the account, then show the decision:

```sh
psql "$DB" -v slug=sms-voting-test -At -f packages/common/src/scripts/sms/resetDecisionVoting.sql
psql "$DB" -v phone=+15555550123 -At -f packages/common/src/scripts/sms/resetSmsAccount.sql
psql "$DB" -v slug=sms-voting-test -At -f packages/common/src/scripts/sms/describeDecisionProcess.sql | jq .
```

The staging walkthrough that uses these scripts is in
[`docs/twilio-configuration.md`](../../../../../docs/twilio-configuration.md)
under "Manual test through ngrok".
