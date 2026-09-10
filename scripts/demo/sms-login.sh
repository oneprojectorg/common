#!/usr/bin/env bash
#
# SMS login: a participant who already has a phone account signs back in.
#
# Shorter than the Join path and deliberately separate — this is the returning
# visit, not the first one. It needs an account that already holds the test
# number, so run the Join demo first if `--check` complains.
#
#   ./scripts/demo/sms-login.sh --check
#   ./scripts/demo/sms-login.sh

cd "$(dirname "$0")/../.." || exit 1

SESSION="demo-sms-login"
NEED_EXISTING_ACCOUNT=1

demo_help() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }

# shellcheck source=scripts/demo/lib.sh
. scripts/demo/lib.sh

parse_common_args "$@"
begin

start_signed_out

say "A returning participant opens the login screen"
goto "$APP/en/login"
must ab wait --text "Sign in"
beat
shot 1-login-email

say "Phone is offered alongside email here too"
must ab find role button click --name "Use a phone number instead"
must ab wait --text "We text you a code"
beat
shot 2-login-phone

say "Their number is enough to start"
must ab find role textbox fill --name "Phone number" "$PHONE"
must ab find role button click --name "Sign in"
must ab wait --text "Code sent"
shot 3-code-sent
beat

say "And the code signs them in"
must ab find role textbox fill --name "Code" "$CODE"
must ab find role button click --name "Login"
beat
shot 4-signed-in

# A phone-only account is authenticated but not a network member, so `/` is a
# 403 for them. That is by design — the public process is where they belong.
say "A phone account belongs on the public process, not the network home page"
note "membership reads an email address, so this account is admitted nowhere else"
goto "$APP/en/decisions/$SLUG"
must ab wait --text "Start a proposal"
shot 5-back-on-the-process

finish
