# Demo scripts

Scripted walkthroughs of the SMS/Join flows, for showing work to people who are
not going to run it themselves. One script per flow:

| Script             | Flow                                                       |
| ------------------ | ---------------------------------------------------------- |
| `join-path.sh`     | No account → Join by phone → onboarding → submit a proposal |
| `email-claim.sh`   | The same modal, claimed by email                            |
| `sms-login.sh`     | A returning phone account signs back in                     |
| `reset-account.sh` | Frees the demo phone number so the join path can run again  |

`lib.sh` is shared plumbing — browser session, narration, preconditions. Source
it, do not run it.

```bash
./scripts/demo/join-path.sh --check       # preconditions only, changes nothing
./scripts/demo/join-path.sh --reset       # free the test number, then run
./scripts/demo/join-path.sh --beat 2000   # slower, for a bigger room
./scripts/demo/join-path.sh --record      # record it instead of showing a window
./scripts/demo/join-path.sh --record --fps 10  # smaller file for a long take
```

Preconditions are checked before anything else. The usual reason the Join flow
"cannot be reproduced" is that the process is public but its grant lacks
`SUBMIT_PROPOSALS` (bit 128), in which case no Join button renders at all;
`--check` says so directly.

## Screen recording

**Status: unreliable. Do not count on `--record` for anything that matters.**
It produced a correct video twice in a row under test and still fails in normal
use. If you need a video for a real audience, capture the screen instead
(macOS: Cmd-Shift-5 → Record Selected Portion) and run the demo without
`--record`.

The rest of this section is what we established while debugging it, so the next
person does not repeat the work.

### The symptom

The video is a few seconds long for a demo that ran for a minute, and appears
to show only one screen. It is not sped up and it is not "the end result" — it
is the *beginning*, frozen. In the failing artifact (`6.77s`, 203 frames, for a
~60s run), frames 0, 50, 100, 150 and the final frame were all the same landing
page. The claim modal, the code screen, onboarding and the proposal were absent
entirely.

### Root cause

`agent-browser record` captures the browser's own compositor. A **headed**
Chrome only paints while its window is actually on screen. During a scripted
demo the operator is watching the terminal, so the window ends up occluded,
Chrome stops producing frames, and ffmpeg is starved.

agent-browser reports this only when `record stop` runs, so scripts must capture
that command's failure rather than assume `record start` guaranteed a file:

```
$ agent-browser --session demo-join record stop
✗ ffmpeg failed: Output #0, webm, to '…webm':
  [out#0/webm] Output file does not contain any stream
  Error opening output file …
  Error opening output files: Invalid argument
```

"Output file does not contain any stream" means ffmpeg received **zero** frames,
so it never configured an output stream. Watching the path during a run
confirms it: the file is not created at all while recording, and ffmpeg exits
with that error at stop.

Note this is *not* the same failure as agent-browser 0.34, which recorded in a
separate browser context and dropped the claim dialog when its Phone tab was
clicked. 0.37 records the active page as-is; this failure is about painting.

### Evidence

Same script, same steps, varying one thing at a time. Current agent-browser
reports both encoded `frames` and distinct `capturedFrames`: encoded frames are
held to the requested FPS on a successful recording, while `capturedFrames`
still varies with page repaints. These older counts were useful because the
bad files had very few distinct captured frames and never reached the later
screens:

| Mode                        | Result                                          |
| --------------------------- | ----------------------------------------------- |
| Headless                    | 34.4s of video for a 34.7s run — complete       |
| Headed                      | 48, 49, 151, 203, 0 frames — first screen only  |
| Headed, three clean trials  | all truncated (48 / 49 / 151)                   |

The reliable tell is not frame count but **whether the last frame differs from
the first**. A truncated recording ends on the state it started in.

### Ruled out, with evidence

Both of these looked convincing on one sample and did not survive replication.
Do not re-chase them:

- **`ab screenshot` killing the screencast.** First test: 1572 frames without a
  screenshot vs 49 with one. On replication: 1630 frames *with* a screenshot,
  501 without.
- **`ab set viewport`.** Runs with and without it both truncate and both
  succeed. Frame counts: viewport `478/329/975/140/48/65`, no viewport
  `1526/1630/1033/501/150/0`.

Also checked and not the cause: stale browser windows from earlier sessions
(closing everything with `close --all` made it *worse*, not better), and Chrome
launch flags — agent-browser already passes
`--disable-backgrounding-occluded-windows`, which governs renderer priority,
not whether an occluded window paints.

### What changed in `lib.sh`

- `ensure_browser` drops `--headed` when `--record` is on. The flag now means
  *record it* rather than *watch it and also record it*.
- `stop_recording` checks whether `record stop` failed and prints `✗ no usable
  video was written` with ffmpeg's own first line, then clears `RECORD_PATH` so
  `finish()` cannot point at a file that does not exist. Previously the error
  was discarded by `>/dev/null 2>&1`, which is why a starved recording looked
  like a successful run.
- `--fps` is passed through to `agent-browser record start`, so long takes can
  trade motion detail for smaller files.
- `stop_recording` compares video duration against wall-clock time and warns
  when the video is under half the run. A starved-but-valid file is otherwise
  indistinguishable from a good one.

Two consecutive `join-path.sh --record` runs after this reported `16s of video
for 17s of demo` and `16s of video for 21s of demo`, ending on the submit
confirmation rather than the landing page. That is a real improvement and it is
**not** a fix — the failure is intermittent and still occurs.

### Open questions

- What actually varies between a headless run that captures everything and one
  that captures nothing (`hA` produced 0 frames where `hB`/`hC` produced full
  recordings from an identical script). Machine load and display state are the
  obvious suspects; neither has been pinned down.
- Whether the screencast can be kept alive deliberately — a periodic no-op that
  forces a repaint might keep frames flowing regardless of window state.
- Whether this is worth reporting upstream. `record stop` failing *after* the
  run, with no signal at `record start` and no partial file, is poor behaviour
  regardless of the cause.

### Diagnosing a bad recording

```bash
# 1. Does the file exist at all, and how long is it?
ffprobe -v error -count_frames \
  -show_entries format=duration -show_entries stream=nb_read_frames \
  -of default=noprint_wrappers=1 REC.webm

# 2. Compare duration against how long the demo actually took.
#    Much shorter means starved, not sped up.

# 3. The decisive check: does the last frame differ from the first?
ffmpeg -v error -i REC.webm -frames:v 1 first.png
ffmpeg -v error -sseof -0.3 -i REC.webm -update 1 last.png
#    Same image → capture died at the start and the run was never recorded.

# 4. If a recording is still active, ask agent-browser directly in the demo
#    session.
agent-browser --session demo-join record stop
agent-browser doctor          # confirms ffmpeg, libvpx, libx264
```

## The demo phone number

`+15005550006` is reserved for these scripts and is listed in
`[auth.sms.test_otp]`, so GoTrue accepts its fixed code, never contacts Twilio,
and the demo costs nothing and works offline. The other listed numbers
(`…0007`–`…0010`) belong to the e2e suite — do not borrow them, the suite runs
in parallel and would race.

`--reset` frees the number by moving its previous holder to a spare
`1500555xxxx` rather than deleting the account, because those accounts own
proposals the demos display. `reset-account.sh --sweep` cleans up the parked
ones that own nothing.
