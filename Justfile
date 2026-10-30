# Local SMS voting demo helpers. Every recipe reads DATABASE_URL from .env.local
# and acts on the local database only. `just` lists them.

scripts := "packages/common/src/scripts"
db := `grep '^DATABASE_URL=' .env.local | cut -d= -f2-`
slug := "sms-voting-test"
phone := "+18182124554"

# List the recipes.
default:
    @just --list --unsorted

# Print one decision's whole voting state as JSON: decision, chat line, districts, every voter's registration, draft and cast ballot.
sms-show slug=slug:
    @psql "{{db}}" -v slug={{slug}} -At -f {{scripts}}/describeDecisionProcess.sql | jq .

# Delete every voter's registrations, drafts and cast ballots on one decision; proposals, districts, access and the chat line stay.
sms-reset-decision slug=slug:
    @psql "{{db}}" -v slug={{slug}} -At -f {{scripts}}/resetDecisionVoting.sql

# Delete the account behind one phone number (GoTrue user, profile and what it owns) so JOIN starts from scratch.
sms-reset-account phone=phone:
    @psql "{{db}}" -v phone={{phone}} -At -f {{scripts}}/resetSmsAccount.sql

# Reset the decision and the account, then show the decision: the full demo from JOIN.
sms-reset slug=slug phone=phone: (sms-reset-decision slug) (sms-reset-account phone) (sms-show slug)
