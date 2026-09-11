#!/usr/bin/env bash
#
# The Join path: how someone with no account joins a public process by phone.
#
# This is the flow the SMS work exists to enable, and the one to watch. Six
# beats, in the order a participant meets them:
#
#   1. A public process offers Join, where a private one offers Log in.
#   2. Join opens the claim modal.
#   3. Both channels are offered up front — Email and Phone number.
#   4. A number alone does not create an account; a code is required.
#   5. The code is accepted and the visitor lands in onboarding.
#   6. Back on the process, the account can act.
#   7. It submits a proposal, and the proposal lands in the phase.
#
#   ./scripts/demo/join-path.sh --check     # verify preconditions only
#   ./scripts/demo/join-path.sh --reset     # free the test number, then run
#   ./scripts/demo/join-path.sh --beat 2000 # slower, for a bigger room
#   ./scripts/demo/join-path.sh --record    # record it instead of showing a window
#   ./scripts/demo/join-path.sh --record --fps 10  # lower frame rate for a long take

cd "$(dirname "$0")/../.." || exit 1

SESSION="demo-join"
NEED_PUBLIC_PROCESS=1
NEED_FREE_NUMBER=1

demo_help() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }

# shellcheck source=scripts/demo/lib.sh
. scripts/demo/lib.sh

PROPOSAL_TITLE="Bike racks outside the library #$RANDOM"

parse_common_args "$@"
begin

start_signed_out

say "A visitor with no account opens a public process"
goto "$APP/en/decisions/$SLUG"
must ab wait --text "Join"
start_recording
beat

say "The header offers Join, not Log in — this process is open to everyone"
note "canJoin is server-derived; a process without SUBMIT_PROPOSALS shows nothing here"
shot 1-join-button
beat

say "Join opens the claim modal"
must ab find role button click --name "Join"
must ab wait --text "Don't lose track of this idea"
beat
shot 2-claim-modal

say "Both channels sit side by side — no one has to go looking for phone"
must ab find role tab click --name "Phone number"
must ab wait --text "We text you a code"
beat
shot 3-phone-channel

say "A phone number is all it takes to start"
must ab find role textbox fill --name "Phone number" "$PHONE"
beat
must ab find role button click --name "Text me a code"

# The heart of the demo. Autoconfirm is off, so GoTrue demands the code
# instead of issuing a session on the number alone. Without this, anyone
# could claim an account against a number they do not hold.
if ! ab wait --text "Code sent" >/dev/null 2>&1; then
  echo "✗ no code was requested — $PHONE is most likely already taken." >&2
  echo "  Re-run with --reset to free it." >&2
  shot 4-signup-blocked
  exit 1
fi

say "A code is required — the number alone creates nothing"
note "this is what turning GoTrue's SMS autoconfirm off buys us"
shot 4-code-required
beat

say "With the code, the account is real"
must ab find role textbox fill --name "Code" "$CODE"
must ab find role button click --name "Create profile"
must ab wait --text "Add your personal details"
restart_recording
shot 5-onboarding
beat

say "Onboarding asks for a name and the terms"
note "worth noticing: a phone-only signup is still asked for an email here"
ab find role textbox fill --name "Full name" "Demo Participant" >/dev/null 2>&1
ab find role textbox fill --name "Headline" "Joined by text" >/dev/null 2>&1
ab find role textbox fill --name "Email" "demo-$RANDOM@example.com" >/dev/null 2>&1
shot 6-onboarding-filled
ab find role button click --name "Continue" >/dev/null 2>&1
ab wait --text "One last step" >/dev/null 2>&1
ab find nth 0 "[role=checkbox]" check >/dev/null 2>&1
ab find nth 1 "[role=checkbox]" check >/dev/null 2>&1
ab find role button click --name "Join Common" >/dev/null 2>&1

# A returning account may meet the policy re-acceptance interstitial.
if ab wait --text "updated our policies" >/dev/null 2>&1; then
  ab find nth 0 "[role=checkbox]" check >/dev/null 2>&1
  ab find role button click --name "Agree and continue" >/dev/null 2>&1
fi

if ! ab wait --text "Start a proposal" >/dev/null 2>&1; then
  say "Onboarding did not finish; the participation beats are skipped"
  shot 7-onboarding-incomplete
  finish
  exit 0
fi
restart_recording

say "And back on the process, this account can act"
note "no email on the auth record — the account exists because of a phone number"
shot 7-can-participate
beat

say "So it starts a proposal"
must ab find role button click --name "Start a proposal"
must ab wait --text "Proposal title"
beat
shot 8-proposal-editor

say "Title and summary are all this process asks for"
note "no location field here, so nothing needs a geocoder"
must ab find role textbox fill --name "Proposal title" "$PROPOSAL_TITLE"
must ab find role textbox fill --name "Proposal summary" \
  "Submitted from a phone-only account, to show the whole path works end to end."
beat
shot 9-proposal-filled

say "Submitting is deliberately final, so it asks first"
must ab find role button click --name "Submit"
must ab wait --text "Submitting is final"
beat
shot 10-submit-confirm

# With the dialog open the page behind it is inert, so this name resolves to
# the dialog's button rather than the editor's.
must ab find role button click --name "Submit"
must ab wait --text "Current Phase"
must ab wait --text "$PROPOSAL_TITLE"
say "And the proposal is in the phase, authored by a phone number"
shot 11-proposal-submitted

finish
