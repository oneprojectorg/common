#!/usr/bin/env bash
#
# The other half of the Join path: claiming by email.
#
# Same modal, same two-step shape, so running it after the Join demo shows the
# channels are peers rather than one being bolted on. Reads the code out of
# the local mail catcher, so nothing leaves the machine.
#
#   ./scripts/demo/email-claim.sh --check
#   ./scripts/demo/email-claim.sh

cd "$(dirname "$0")/../.." || exit 1

SESSION="demo-email-claim"
NEED_PUBLIC_PROCESS=1

demo_help() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }

# shellcheck source=scripts/demo/lib.sh
. scripts/demo/lib.sh

parse_common_args "$@"

# A fresh address each run, so the claim never collides with an earlier one.
EMAIL="demo-claim-$RANDOM@example.com"

begin

if ! curl -sf -o /dev/null --max-time 5 "$CODE_INBOX"; then
  echo "✗ mail catcher not reachable at $CODE_INBOX — the code cannot be read" >&2
  exit 1
fi
echo "✓ mail catcher reachable at $CODE_INBOX"

start_signed_out

say "The same Join button, the same modal"
goto "$APP/en/decisions/$SLUG"
must ab find role button click --name "Join"
must ab wait --text "Claim your account"
beat
shot 1-claim-modal

say "Email is the default channel"
note "using $EMAIL"
must ab find role textbox fill --name "Email" "$EMAIL"
beat
must ab find role button click --name "Email me a code"
must ab wait --text "Email sent"
shot 2-email-sent
beat

say "The code arrives in the local mail catcher"
CLAIM_CODE=$(latest_email_code)
if [ -z "$CLAIM_CODE" ]; then
  echo "✗ no six-digit code found in the newest message" >&2
  exit 1
fi
note "code $CLAIM_CODE"

say "And it completes the claim, exactly as the phone code does"
must ab find role textbox fill --name "Code" "$CLAIM_CODE"
must ab find role button click --name "Create profile"
must ab wait --text "Add your personal details"
shot 3-onboarding

finish
