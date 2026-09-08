# Handoff — process setup prototype

Two audiences, one document.

- **Engineering** — this is not code to merge. It is a **working specification**:
  every rule below is implemented and can be run, poked and disagreed with. Build
  the real thing from it; use the files named here as the reference
  implementation. Start at [Rules that are not obvious](#rules-that-are-not-obvious).
- **Design** — this is how to run it and keep changing it while nobody is
  watching. Start at [Running and iterating](#running-and-iterating).

The artifact link is the review surface. The source is the truth. When they
disagree, the source wins — the artifact is a build of it.

---

## What this is

A walkable copy of Common's decision-process setup, from the decisions list
through the create wizard to a live process:

```
decisions list → Create → wizard (5 steps) → process overview (draft)
  → phase editors → Launch → process overview (live) → current phase + proposals
```

It renders the **real design system** (`@op/sense`, `@op/styles`) as workspace
siblings rather than copies, so what you see is what the product's components
actually do. Everything else — router, database, auth, i18n — is replaced by the
smallest thing that lets the screen exist.

### What it is not

- **Not product code.** `apps/prototype/` is disposable. Nothing outside it
  imports from it, and deleting the directory removes it completely.
- **Not a data model.** The store in `src/components/prototype/store.ts` is a
  localStorage blob shaped for screens, not a schema. Field names are convenient,
  not proposed.
- **Not translated.** Prototype-only copy is plain English strings. Anything that
  belongs to the design was written to read correctly, but it has not been through
  the dictionaries.

---

## Running and iterating

```bash
pnpm -C apps/prototype dev      # http://localhost:3120
pnpm -C apps/prototype build    # dist/index.html + dist/artifact.html
```

There is a `.claude/launch.json` entry named `prototype-vite` that starts the
same server.

To publish a change to the artifact, ask Claude Code to build and publish; it
redeploys to the same URL. **Only the artifact's owner can update it** — a shared
artifact is readable and commentable by everyone in the org, but not editable. If
you publish from your own session you will get your own link, which is fine: say
so, and that link becomes the live one for the duration.

Reset all state:

```js
localStorage.removeItem('op-prototype-processes');
```

### Where the screens live

| Screen | File |
| --- | --- |
| Decisions list | `PrototypeDecisionsList.tsx` |
| Create wizard | `../decisions/CreateProcessWizard/` (+ `PrototypeWizard.tsx` wrapper) |
| "How it runs on Common" step | `../decisions/CreateProcessWizard/steps/MappingStep.tsx` |
| Process overview (draft + live) | `PrototypeProcessOverview.tsx` |
| Phase rail (the timeline column) | `PrototypePhaseRail.tsx` |
| Phase editor | `PrototypePhasePage.tsx` |
| Form / criteria / field builder | `PhaseFieldEditor.tsx` |
| Current phase + proposals list | `PrototypeCurrentPhasePage.tsx` |
| Proposals toolbar (filter/sort/search/export) | `PrototypeProposalsToolbar.tsx` |
| Launch modal + confirmation | `PrototypeLaunchModal.tsx` |
| Launch timings, in one place | `launchChoreography.ts` |
| Reorder confirmation + refusal | `PrototypeReorderDatesModal.tsx` |
| Model, copy, vocabulary, fixtures | `store.ts` |

The code carries its own reasoning. Nearly every non-obvious decision has a
comment saying why, and several say what the wrong version was first. Read those
before changing behaviour — a few of them are the scar tissue of a bug that took
a while to find.

---

## Rules that are not obvious

These are the ones that cost real thought, would be easy to reimplement wrongly,
and are invisible from a screenshot.

### 1. Reordering phases reflows dates

`reflowPhaseDates()` in `store.ts`.

- Every phase **keeps its own duration**. A 5-day phase dropped into a 14-day
  slot is still 5 days; it does not inherit the window it landed in.
- Start dates run **sequentially in the new order**, from the date the process
  already starts on (the earliest of them, which does not depend on order).
- Each phase begins the **day after** the previous one ends. Phases are
  contiguous and never overlap. *(The written spec said "starts when the previous
  one ends"; the seed data is contiguous, so this is the reading we shipped.
  Confirm it.)*
- **Undated phases take no time** and are skipped, so a half-set-up rail reflows
  the dated phases around them.

### 2. A reorder is confirmed, not applied

`PrototypeReorderDatesModal.tsx`, driven from `PrototypePhaseRail.tsx`.

- On drop the list **previews the new order** but every card keeps its **old
  dates**. Nothing recomputes until the admin confirms.
- The dialog lists only phases whose dates change, in the new order, and says
  "*N* other phases keep their dates" for the rest.
- Cancel restores the previous order. Confirm applies order *and* dates, and
  pulses the changed date labels for under a second.
- Undated phases, or a reorder that happens to change no dates, apply
  immediately with no dialog.

### 3. What has already run cannot be reordered

`reorderBlockFor()` in `PrototypeReorderDatesModal.tsx`. **This is the invariant
most likely to be lost in a rewrite.**

Every phase up to *and including* the running one is **settled** — it either
already happened or is happening now, and its dates are what the rest of the
schedule is built from. So the whole guard is one comparison: **that run of
phases must come back in the same order.** Everything after it is free.

It refuses, with an alert rather than a choice:

| move | why |
| --- | --- |
| a dated phase dragged before the running one | would push the running phase later |
| the running phase itself | people are taking part in it |
| a phase from before it to after it | would pull the running phase earlier |

A draft has nothing settled, so nothing is ever refused there.

Related wrinkle worth fixing properly in the real thing: `currentPhaseIndex` is
**positional**, so without this guard reordering silently moved which phase was
"running". The guard prevents it; a stable phase id would remove the class of bug.

### 4. The launch sequence

`launchChoreography.ts` holds every duration and delay, exported both as numbers
and as CSS custom properties so JS and CSS share one source. Two rules matter
more than the numbers:

- **Nothing enters or leaves layout instantly.** Anything appearing grows its own
  height first; anything leaving collapses. A flex `gap` cannot do this — it
  appears at full size the moment a second child mounts — so spacing that has to
  animate lives *inside* the box being animated. This bit twice.
- **The page stays draft until the confirmation is dismissed.** Pressing Launch
  writes the record, but the page keeps rendering from a **snapshot** taken just
  before (`draftBeforeLaunch`), so the whole transition is still there to watch
  when the dialog closes. Holding only the chrome was not enough: `status` and
  `currentPhaseIndex` drive nearly everything else on the page.

Order once the dialog closes: header crossfades (draft first, live over it) →
title tints → hero grows its CTA row then the buttons rise → the running phase's
card turns over → the rail closes up → edit affordances last.

### 5. The phase card's two treatments must stay geometrically identical

`PrototypePhaseRail.tsx` (`EditingPhaseCell`, `SetupCard`) against
`@op/sense/PhaseCard`.

The launch sequence animates one card *into* the other, which only works because
the draft cell and the live card agree on everything except the badge row:

- same `gap-4` and same **`size-8` trailing box** (a chevron against a hover
  arrow — mismatched, the name got different widths and wrapped differently)
- a **ring, not a border** (a real border makes the row 2px taller)
- **`min-h-5`** subtext, matching `PhaseCard`'s date line

Break any of these and the launch animation regains the step it took three
attempts to remove. If the real implementation uses one component with props
instead of two components — which it should — this whole class of problem
disappears.

### 6. Vocabulary drives the nouns

`vocabulary(process, phaseType)` in `store.ts`. A process says "application",
"idea", "proposal" or "submission" depending on its type, and a participatory
budget with a develop phase says **"idea" for the submissions phase and
"proposal" after it** — the two rounds are different things.

This feeds headings, empty states, buttons, the proposals toolbar and the phase
editor's tab labels ("Applications form" vs "Ideas form"). Any real
implementation needs the same indirection or the copy goes wrong in a grant round.

### 7. Editable titles: the persistent-pencil pattern

`PrototypeTitleField.tsx`, used by the phase editor and the draft hero.

- Pencil visible **at rest**, muted → foreground on hover, `aria-hidden`; the
  title and pencil are one hit area.
- A tint on approach (`accent`, because these pages sit on `muted` and a muted
  tint would be invisible). Editing drops **both** the pencil and the tint.
- Entering edit **selects all**. Enter commits, Esc reverts, blur commits —
  Enter and Esc return focus to the title, blur does not (focus already went
  where you clicked).
- **A blank or whitespace-only value reverts.** A title is never empty.
- The field keeps the heading's exact type metrics, so nothing shifts. On a
  *centred* title the pencil's space is held while editing, or the text
  recentres and jumps sideways.
- Edits go to local form state and mark the page dirty. No per-field save, no
  toast.

### 8. Dates already taken are not offered

`PrototypeDateRangeField.tsx` + `takenWindows()` in `PrototypePhasePage.tsx`.
Windows belonging to **earlier** phases are disabled in the picker, and an unset
window opens on the first month with room. Later phases are not blocked — this
phase runs before them, so their dates are the ones that should move.

Dates are stored date-only (`2026-09-05`) and parsed to **local noon**
(`parseDay`). Parsing them as UTC midnight shifts every boundary a day west of
UTC — the trap is documented in `formatDate.ts`.

### 9. Search is a filter, not a jump

`PrototypeProposalsToolbar.tsx`. The search icon sits left of Filter and expands
in place into a field that filters the list. It stays open while it holds a term,
Esc clears and collapses, and the term is **not** counted in the Filter badge —
that panel no longer contains it. There is no command palette; an earlier
Cmd+K "jump to a proposal" was removed deliberately.

### 10. The mapping step is a selection, not an accordion

`steps/MappingStep.tsx`. Exactly one step is open at all times; opening one closes
the other; clicking the open card does nothing. There is no collapsed-all state.
Callout icons are matched on the copy itself (`calloutIcons.ts`) so each is
literal.

---

## Real vs faked

| Area | Status |
| --- | --- |
| Design system, tokens, type | **Real** — `@op/sense` + `@op/styles` from source |
| Rich text editing | **Real** Tiptap, real extensions; toolbar commands genuinely apply |
| Drag to reorder | **Real** `@op/sense/Sortable` (dnd-kit), keyboard-operable |
| Persistence | localStorage under `op-prototype-processes`; seeded processes are copy-on-write |
| Proposals | Fixtures in `proposalFixtures.ts`. Filtering, sorting, search and CSV export are real over them |
| Images / banners | **By URL only.** No upload — that is the product's job |
| Invitees, admins, directory | Fixtures in `fakeUser.ts`; invites land straight on the list |
| Assignments | Stored and read back, but nothing is actually assigned — there are no reviewers' queues |
| Develop phase body | Deliberately marked TBD on screen; the design is not settled |
| CSV export | Real file, via the artifact host's `downloads` capability |
| Auth, roles, permissions | None. Every screen is the admin's view |

---

## Open questions

Decisions we did not make, in rough order of how much they matter.

1. **"FPP"** — a menu item reads "Reset (FPP)" and nobody in this thread could
   expand the acronym. Rename or remove it.
2. **Rewriting history** — the reorder guard protects the *running* phase.
   Reordering two already-finished phases is still allowed and rewrites their
   past dates. Probably also wrong; not specified.
3. **Mapping cards: three callouts or all of them?** The spec said three; 6 of the
   18 process pieces carry four. All are rendered rather than silently dropping
   written copy. One `.slice(0, 3)` if you disagree.
4. **The develop phase's tab label** — named by the same noun rule as submissions
   ("Proposals form"), which was inferred, not asked for.
5. **Duplicate search affordance** — an active search term shows both in the field
   and as a removable chip in the results row, because every other active filter
   gets a chip.
6. **Mapping step images** — `ProcessPiece` has no image field, so every card uses
   the gradient placeholder. The slot is real and correctly sized; drop assets in
   and nothing about the layout changes.
7. **Card contents during the launch sequence** — the rail's outer height animates
   smoothly, but the cards inside swap treatment in one frame. Invisible to most
   eyes, and the honest fix is one card component rather than two.

---

## Changes outside the prototype

The prototype is disposable, but it does not sit alone in this branch. Three
other groups of change are here, and **none of them are throwaway** — they are
worth separating before anyone decides what to do with the prototype itself.

### Design system — shippable on its own

Made for the prototype's sake, improvements either way:

- `packages/sense/.../ui/badge.tsx` — `font-sans` on the base, so a badge stops
  inheriting a serif from its container.
- `packages/sense/.../PhaseCard/index.tsx` — `data-slot` on the current card and
  its trailing arrow so a consumer can target them (+ stories).
- `packages/sense/.../ui/popover.tsx` — `container` / `positionMethod` /
  `collisionAvoidance` passthrough.
- `packages/styles/theme.css` — an `--animate-gradient-drift` keyframe for the
  wizard's opening screen, plus a `./theme` export in `package.json`.

### Real product code — a feature, not a prototype

`apps/app/src/components/decisions/CreateProcessWizard/` is the create-process
wizard, built as product code and reached at `/decisions/new`. The prototype
*wraps a copy of it*. Along with it:

- `apps/app/.../SiteHeader/CreateMenu.tsx`
- **all seven i18n dictionaries** (~210 keys each — the wizard's copy, translated)
- `tests/e2e/tests/a11y-baseline.spec.ts` — a baseline entry for the wizard route

This is the one part of the branch that looks like ordinary reviewable work. It
does not depend on the prototype and could go through review on its own.
