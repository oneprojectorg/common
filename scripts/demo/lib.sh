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
RECORD=0
RECORD_PATH=""
RECORD_CURRENT_PATH=""
RECORD_ACTIVE=0
RECORD_FPS=""
RECORD_HEADED=0
RECORD_STARTED_AT=0
RECORD_SEGMENT=0
RECORD_ANNOUNCED=0
RECORD_PARTS=()
SHOTS=()

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
        RECORD=1
        if [ "${2:-}" != "" ] && [[ "$2" != -* ]]; then RECORD_PATH="$2"; shift; fi
        ;;
      --fps) RECORD_FPS="$2"; shift ;;
      --record-headed) RECORD_HEADED=1 ;;
      -h|--help) demo_help; exit 0 ;;
      *) DEMO_ARGS+=("$1") ;;
    esac
    shift
  done
}

ab()   { agent-browser --session "$SESSION" "$@"; }
say()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
note() { printf '   \033[2m%s\033[0m\n' "$*"; }
beat() { force_recording_repaint; ab wait "$BEAT" >/dev/null; }
shot() {
  local path="$OUT/$1.png"
  ab screenshot "$path" >/dev/null && { SHOTS+=("$path"); note "saved $path"; }
  # Rebind recording to the current page after the screenshot has forced a
  # paint. The following beat/action then records this named state instead of
  # the stale screencast target agent-browser 0.37 can keep after navigation.
  [ "$RECORD_ACTIVE" = "1" ] && restart_recording
  force_recording_repaint
  [ "$RECORD_ACTIVE" = "1" ] && ab wait 300 >/dev/null
}

# Chrome screencast frames are repaint-driven. In headless recording runs a
# quiet page can stop feeding ffmpeg before the interesting state changes. Keep
# a tiny, nearly transparent marker changing so there is always a fresh paint.
force_recording_repaint() {
  [ "$RECORD_ACTIVE" = "1" ] || return 0
  ab eval "(() => {
    const id = '__demo_recording_tick';
    const tick = String(Date.now());
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:fixed;inline-size:1px;block-size:1px;inset-block-end:0;inset-inline-end:0;opacity:0.01;pointer-events:none;z-index:2147483647;background:transparent;';
      document.documentElement.appendChild(el);
    }
    el.style.transform = 'translateX(' + (Number(tick) % 2) + 'px)';
  })()" >/dev/null 2>&1 || true
}

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
  # Headed everywhere except while recording. `record` captures the browser's
  # own compositor, and a headed Chrome only paints while its window is on
  # screen — during a scripted demo the operator is watching the terminal, the
  # window sits occluded, and Chrome stops producing frames. ffmpeg is then fed
  # nothing and the video ends a second or two in, on the first screen.
  local i headed="--headed"
  [ "$RECORD" = "1" ] && [ "$RECORD_HEADED" != "1" ] && headed=""
  for i in 1 2 3 4 5; do
    # shellcheck disable=SC2086 # deliberately unquoted: empty means no flag
    ab open "about:blank" $headed >/dev/null 2>&1 && return 0
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

# Record the active page as-is (agent-browser >= 0.37): no new context, no
# new tab, no navigation. Start this after the first real page has loaded;
# starting on about:blank and then navigating has produced starved recordings.
# Stop is trapped on EXIT so failed beats still save what they captured.
start_recording() {
  [ "$RECORD" = "1" ] || return 0
  [ "$RECORD_ACTIVE" = "1" ] && return 0

  RECORD_PATH="${RECORD_PATH:-$OUT/recording-$(date +%Y%m%d-%H%M%S).webm}"
  RECORD_STARTED_AT=${RECORD_STARTED_AT:-0}
  [ "$RECORD_STARTED_AT" = "0" ] && RECORD_STARTED_AT=$(date +%s)

  local stem ext fps_arg=()
  stem="${RECORD_PATH%.*}"
  ext="${RECORD_PATH##*.}"
  [ "$stem" = "$RECORD_PATH" ] && ext="webm"
  RECORD_SEGMENT=$((RECORD_SEGMENT + 1))
  RECORD_CURRENT_PATH="$stem.part-$(printf '%03d' "$RECORD_SEGMENT").$ext"

  [ -n "$RECORD_FPS" ] && fps_arg=(--fps "$RECORD_FPS")
  if ab record start "$RECORD_CURRENT_PATH" "${fps_arg[@]}" >/dev/null 2>&1; then
    RECORD_ACTIVE=1
    if [ "$RECORD_ANNOUNCED" = "0" ]; then
      note "recording to $RECORD_PATH${RECORD_FPS:+ at ${RECORD_FPS} fps}"
      RECORD_ANNOUNCED=1
    fi
    trap 'stop_recording' EXIT
    force_recording_repaint
  else
    note "could not start recording — continuing without it (agent-browser doctor? brew install ffmpeg?)"
    RECORD=0
  fi
}

restart_recording() {
  [ "$RECORD" = "1" ] || return 0
  stop_recording_segment || true
  start_recording
}

# agent-browser 0.37 can keep recording the old screencast target across some
# app navigations. The demos therefore record short segments and stitch them at
# the end; restart after known route changes with restart_recording.
stop_recording_segment() {
  [ "$RECORD_ACTIVE" = "1" ] || return 0
  RECORD_ACTIVE=0

  local out parsed err frames captured
  out=$(ab record stop --json 2>&1)
  parsed=$(printf '%s\n' "$out" | python3 -c '
import json, sys
try:
    payload = json.load(sys.stdin)
except Exception:
    print("error\t" + "record stop returned non-JSON output")
    raise SystemExit
if not payload.get("success"):
    error = (payload.get("error") or "").splitlines()[0]
    print("error\t" + error)
else:
    data = payload.get("data") or {}
    print("ok\t{}\t{}".format(data.get("frames", ""), data.get("capturedFrames", "")))
' 2>/dev/null)
  case "$parsed" in
    ok$'\t'*)
      frames=$(printf '%s' "$parsed" | cut -f2)
      captured=$(printf '%s' "$parsed" | cut -f3)
      ;;
    error$'\t'*)
      err=$(printf '%s' "$parsed" | cut -f2-)
      ;;
    *)
      err=$(printf '%s\n' "$out" | sed -n '1{s/^✗ //;p;}')
      ;;
  esac

  if [ -n "${err:-}" ] && [ -s "$RECORD_CURRENT_PATH" ]; then
    err=""
  fi

  if [ -n "${err:-}" ] || [ ! -s "$RECORD_CURRENT_PATH" ]; then
    rm -f "$RECORD_CURRENT_PATH"
    RECORD_CURRENT_PATH=""
    return 1
  fi

  RECORD_PARTS+=("$RECORD_CURRENT_PATH")
  RECORD_CURRENT_PATH=""
}

write_slideshow_recording() {
  local list fps img
  local -a codec
  list="$OUT/recording-slides-$(date +%Y%m%d-%H%M%S).txt"
  fps="${RECORD_FPS:-30}"
  : > "$list"
  for img in "${SHOTS[@]}"; do
    printf "file '%s'\n" "$(cd "$(dirname "$img")" && pwd)/$(basename "$img")" >> "$list"
    printf "duration 2\n" >> "$list"
  done
  img="${SHOTS[$(( ${#SHOTS[@]} - 1 ))]}"
  printf "file '%s'\n" "$(cd "$(dirname "$img")" && pwd)/$(basename "$img")" >> "$list"

  case "$RECORD_PATH" in
    *.mp4) codec=(-c:v libx264 -pix_fmt yuv420p) ;;
    *) codec=(-c:v libvpx -pix_fmt yuv420p -b:v 1M) ;;
  esac
  ffmpeg -v error -f concat -safe 0 -i "$list" -vf "fps=$fps,format=yuv420p" \
    "${codec[@]}" -y "$RECORD_PATH" >/dev/null 2>&1 || return 1
  rm -f "$list"
}

cleanup_recording_scratch() {
  local part
  for part in "${RECORD_PARTS[@]}"; do
    rm -f "$part"
  done
}

stop_recording() {
  [ "$RECORD" = "1" ] || return 0
  RECORD=0
  stop_recording_segment || true
  [ "${#RECORD_PARTS[@]}" -gt 0 ] || [ "${#SHOTS[@]}" -gt 0 ] || return 0

  local list wall video part

  if [ "${#SHOTS[@]}" -gt 0 ]; then
    if ! write_slideshow_recording; then
      echo "✗ could not write slideshow recording to $RECORD_PATH" >&2
      RECORD_PATH=""
      cleanup_recording_scratch
      return 1
    fi
  else
    list="$OUT/recording-parts-$(date +%Y%m%d-%H%M%S).txt"
    : > "$list"
    for part in "${RECORD_PARTS[@]}"; do
      printf "file '%s'\n" "$(cd "$(dirname "$part")" && pwd)/$(basename "$part")" >> "$list"
    done
    if ! ffmpeg -v error -f concat -safe 0 -i "$list" -c copy -y "$RECORD_PATH" >/dev/null 2>&1; then
      echo "✗ could not stitch recording segments into $RECORD_PATH" >&2
      RECORD_PATH=""
      rm -f "$list"
      cleanup_recording_scratch
      return 1
    fi
    rm -f "$list"
  fi

  cleanup_recording_scratch

  wall=$(( $(date +%s) - ${RECORD_STARTED_AT:-0} ))
  video=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 \
          "$RECORD_PATH" 2>/dev/null | cut -d. -f1)
  note "saved $RECORD_PATH from ${#SHOTS[@]} screenshot state(s) (${video:-?}s of video for ${wall}s of demo)"
  if [ -n "$video" ] && [ "$wall" -gt 0 ] && [ "$video" -lt $(( wall / 2 )) ]; then
    note "the pauses were dropped — the video plays much faster than the run"
  fi
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
  stop_recording
  say "Done — screenshots in $OUT"
  [ -n "$RECORD_PATH" ] && [ -s "$RECORD_PATH" ] && note "recording at $RECORD_PATH"
  note "Close the window with: agent-browser close --session $SESSION"
}
