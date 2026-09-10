# Shared plumbing for the demo scripts in this directory.
#
# Each demo sources this, then tells its own story. Nothing here knows about a
# particular flow — it owns the browser session, the narration, and the
# preconditions every demo needs.
#
# Source it, do not run it.

set -uo pipefail

APP="${APP:-http://localhost:3100}"
SLUG="${SLUG:-decision-sms-signup-test-proce}"
# The only number in [auth.sms.test_otp]. GoTrue accepts its listed code and
# never contacts Twilio, so a demo costs nothing and works offline.
PHONE="${PHONE:-+15005550006}"
CODE="${CODE:-123456}"
CODE_INBOX="${CODE_INBOX:-http://localhost:54324}"
OUT="${OUT:-./demo-out}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_common}"
# How long each beat lingers so a room can follow. Lower it for a rehearsal.
BEAT="${BEAT:-1200}"

RESET=0
CHECK_ONLY=0

# Every demo takes the same flags. A demo that wants more parses what is left
# in DEMO_ARGS.
DEMO_ARGS=()
parse_common_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --reset) RESET=1 ;;
      --check) CHECK_ONLY=1 ;;
      --slug) SLUG="$2"; shift ;;
      --phone) PHONE="$2"; shift ;;
      --beat) BEAT="$2"; shift ;;
      --record)
        cat <<'EOF'
Recording is not built in.

agent-browser's `record start` runs the demo in a separate browser context,
and in that context the claim dialog closes when its Phone number tab is
clicked — reproducibly, with semantic and ref-based clicks alike. It breaks
the demo at the step the demo exists to show.

Capture the screen instead. It also looks better: it shows the real window.

  macOS:  Cmd-Shift-5 → Record Selected Portion → run the script
  ffmpeg: ffmpeg -f avfoundation -i "1" -r 30 demo-out/demo.mov
          (find the device index with
           ffmpeg -f avfoundation -list_devices true -i "")
EOF
        exit 2
        ;;
      -h|--help) demo_help; exit 0 ;;
      *) DEMO_ARGS+=("$1") ;;
    esac
    shift
  done
}

ab()   { agent-browser "$@" --session "$SESSION"; }
say()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
note() { printf '   \033[2m%s\033[0m\n' "$*"; }
beat() { ab wait "$BEAT" >/dev/null; }
shot() { ab screenshot "$OUT/$1.png" >/dev/null && note "saved $OUT/$1.png"; }

# A step the story depends on. Stop rather than narrate one thing while the
# screen shows another.
must() {
  if ! "$@" >/dev/null; then
    echo "✗ step failed: $*" >&2
    echo "  Run with --check to see whether the preconditions hold." >&2
    exit 1
  fi
}

psql_q() {
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc "$1" 2>/dev/null
}

# The daemon is spawned lazily by the first command that needs it, and the
# connect can lose the race with its own socket. Retry rather than fail a demo
# on a cold start.
ensure_browser() {
  local i
  for i in 1 2 3 4 5; do
    ab open "about:blank" --headed >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "✗ could not start the browser daemon after 5 attempts" >&2
  return 1
}

# Sessions persist cookies between runs. A demo that says "a visitor with no
# account" has to start that way.
start_signed_out() {
  must ensure_browser
  ab set viewport 1440 900 >/dev/null
  ab cookies clear >/dev/null 2>&1
  ab storage local clear >/dev/null 2>&1
  ab storage session clear >/dev/null 2>&1
}

# Next hydrates after the navigation resolves; clicking before that hits a
# button with no handler, which reports success and does nothing.
goto() {
  must ab open "$1"
  ab wait --load networkidle >/dev/null 2>&1
}

# Reads the newest local email and prints its six-digit code. The local mail
# catcher is Mailpit despite the container being named inbucket.
latest_email_code() {
  local id
  id=$(curl -s "$CODE_INBOX/api/v1/messages?limit=1" \
       | python3 -c "import json,sys; print(json.load(sys.stdin)['messages'][0]['ID'])" 2>/dev/null)
  [ -z "$id" ] && return 1
  curl -s "$CODE_INBOX/api/v1/message/$id" | python3 -c "
import json,re,sys
m=json.load(sys.stdin)
b=(m.get('Text') or '')+' '+(m.get('HTML') or '')
c=re.findall(r'\b\d{6}\b', b)
print(c[0] if c else '')" 2>/dev/null
}

# `need_public_process` and `need_free_number` are opt-in: a login demo needs
# neither, so it does not have to pretend to care.
preflight() {
  local ok=0

  if curl -sf -o /dev/null --max-time 5 "$APP/en"; then
    echo "✓ app reachable at $APP"
  else
    echo "✗ app not reachable at $APP — start the dev server"; ok=1
  fi

  if docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
    echo "✓ database container $DB_CONTAINER is up"
  else
    echo "✗ database container $DB_CONTAINER not found"; ok=1; return $ok
  fi

  if [ "${NEED_PUBLIC_PROCESS:-0}" = "1" ]; then
    # The Join button renders only where the public grant carries
    # SUBMIT_PROPOSALS (bit 128); a read-only public process shows nothing.
    local grant
    grant=$(psql_q "
      SELECT arp.permission
      FROM access_role_permissions_on_access_zones arp
      JOIN access_zones az ON az.id = arp.access_zone_id AND az.name = 'decisions'
      JOIN profiles p ON p.id = arp.profile_id
      WHERE p.slug = '$SLUG';")
    if [ -z "$grant" ]; then
      echo "✗ '$SLUG' has no public grant — no Join button will render"; ok=1
    elif [ $(( grant & 128 )) -eq 0 ]; then
      echo "✗ '$SLUG' grant is $grant — no SUBMIT_PROPOSALS, so no Join button"; ok=1
    else
      echo "✓ '$SLUG' is public with SUBMIT_PROPOSALS (grant $grant)"
    fi
  fi

  local holder
  holder=$(psql_q "SELECT coalesce(p.name,'(no profile)') FROM auth.users au
                   LEFT JOIN users u ON u.auth_user_id = au.id
                   LEFT JOIN profiles p ON p.id = u.current_profile_id
                   WHERE au.phone = '${PHONE#+}';")

  if [ "${NEED_FREE_NUMBER:-0}" = "1" ]; then
    if [ -n "$holder" ]; then
      echo "! $PHONE already belongs to '$holder' — signup will say it is taken."
      echo "  Re-run with --reset to free it, or pass --phone."
    else
      echo "✓ $PHONE is free, so signup will run"
    fi
  fi

  if [ "${NEED_EXISTING_ACCOUNT:-0}" = "1" ]; then
    if [ -n "$holder" ]; then
      echo "✓ $PHONE belongs to '$holder', who can sign in"
    else
      echo "✗ no account holds $PHONE — run the join demo first, or pass --phone"; ok=1
    fi
  fi

  return $ok
}

# Frees the listed test number by moving its holder to a spare, rather than
# deleting the account — those accounts own proposals the demos display.
reset_number() {
  local spare="1500555${RANDOM:0:4}"
  psql_q "UPDATE auth.users SET phone = '$spare' WHERE phone = '${PHONE#+}';" >/dev/null
  echo "✓ moved the previous holder of $PHONE to $spare"
}

# Every demo opens the same way.
begin() {
  mkdir -p "$OUT"
  say "Checking preconditions"
  preflight || { [ "$CHECK_ONLY" -eq 1 ] || exit 1; }
  [ "$CHECK_ONLY" -eq 1 ] && exit 0
  [ "$RESET" -eq 1 ] && reset_number
  return 0
}

finish() {
  say "Done — screenshots in $OUT"
  note "Close the window with: agent-browser close --session $SESSION"
}
