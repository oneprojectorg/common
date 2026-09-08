# Process-creation prototype

The screens, one file each. This is the **inner** doc: how the pieces here
behave. For how to run the prototype, what is faked, and the rules engineering
needs, see [`../../../HANDOFF.md`](../../../HANDOFF.md) and
[`../../../CLAUDE.md`](../../../CLAUDE.md).

A walkable copy of the app for reviewing process setup without a session or a
database: **decisions list → Create → wizard → process page → phase pages →
launch → live process**.

Everything in this directory is throwaway. Deleting `components/prototype/`
removes it completely; nothing outside `apps/prototype` imports from it.

What is *not* throwaway: the wizard itself is a copy of real product code at
`apps/app/src/components/decisions/CreateProcessWizard/`, reached in the product
at `/decisions/new`. Edits made here do not reach the product.

## Running it

```bash
pnpm -C apps/prototype dev      # http://localhost:3120
```

> **History.** This prototype used to be hosted inside `apps/app` as a Next
> route on port 3111, and an earlier version of this file documented that setup.
> It is now a standalone Vite app and none of that applies — no Next dev server,
> no `/en/prototype` route, no dev-overlay hiding, no `@tiptap-pro` stubs, and no
> backing services to be down. The one environment trap that survived the move is
> below.

## Environment gotchas

### The CSS is compiled here, not consumed prebuilt

`@op/styles` also exports `./dist/styles.css`, a **build artifact** — and in the
Next app, a utility class that appears nowhere else silently does nothing until
that file is rebuilt.

**That trap does not apply here.** `src/styles.css` imports `@op/styles/theme`
and runs Tailwind over it (`postcss.config.mjs`), so Vite recompiles the theme on
every change and a brand-new class works immediately. It is also why a clean CI
build of this app needs no `packages/styles` build step.

## State

Processes created in the wizard are kept in `localStorage` under
`op-prototype-processes`, alongside one seeded running process defined in
`store.ts`. The seeded one is copy-on-write: the first edit copies it into storage.

Reset everything:

```js
localStorage.removeItem('op-prototype-processes');
```

### Review assignments

A Review phase carries an `assignment` — `open`, `evenly`, `manual`, or `group` —
set from the **Assignments** card on its page. The card never holds a control: it
states the current mode as a sentence and offers one link, because the mode is
what an admin needs to read at a glance and the sentence changing is how an
instant choice confirms itself.

Under `group` the assignment also names the dimensions the pile is cut along.
Several dimensions means several groupings **in parallel** — a proposal belongs
to one group per dimension, not to one cell of a grid.

Groupings are never authored in the Review phase: `groupingDimensions()` collects
every Choice question with options from the phases that run *before* it, so the
pile can only be divided along a line the proposals themselves drew. A Choice
question needs its answers filled in (the **Answers** list in the question
editor) before it can be grouped along. `groupNoun()` turns the question into the
dimension — "Which neighborhood is this for?" into "neighborhood" — because an
admin is choosing between ways to cut the pile, not between questions; the
question itself sits behind an info affordance. A grouping the form cannot
express goes in as free text under **Something else**, to be sorted by the model.

Per-person groups are kept when the mode changes, so flipping to `open` and back
does not lose the assignments.

## Known gaps

Superseded items have been removed: **launch** is fully built (see
`launchChoreography.ts` and HANDOFF §4), **reordering** is real drag via
`@op/sense/Sortable` with a date-reflow guard (HANDOFF §2–3), and the form has a
**preview**. What remains:

- Assignments are stored and read back, but nothing is actually **assigned** —
  there are no reviewer queues.
- **Reviewer-to-group matching** only exists for a single grouping dimension.
  With two or more running in parallel a reviewer covers a group in each, which
  is its own surface; the Reviewers tab says so in a `TODO`.
- **Delete process** is a stub.
- Prototype-only copy is **not** translated — plain strings. Copy that belongs to
  the design was written to read correctly but has not been through the
  dictionaries.
- Choosing an always-open process in the wizard's "other" pathway sets the
  audience to invite-only, and switching back to a timeline leaves it that way.
  Carried over from the design deliberately; reads like a papercut.
- `@op/sense`'s `Switch` has no `cursor-pointer` and no hover state — the whole
  app is affected (11 call sites). Found here, deliberately **not** fixed: it is
  a design-system change.

Open design questions — the ones that need a decision rather than a fix — are in
[`../../../HANDOFF.md`](../../../HANDOFF.md#open-questions).
