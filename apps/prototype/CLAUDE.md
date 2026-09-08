# CLAUDE.md — apps/prototype

Guidance for agents working in `apps/prototype`. The root `CLAUDE.md` still
applies; this adds what is specific to the prototype and overrides it where they
disagree.

Read [`HANDOFF.md`](./HANDOFF.md) before changing behaviour — it holds the rules
that are not visible from the markup.

## What this is

A Vite SPA whose only job is to be **shareable**: `build` produces one
self-contained HTML file that renders the real design system with no server,
database or Next.js. It is a specification for engineering, not code to ship.

- Everything in `src/components/prototype/` is **disposable**. Nothing outside
  `apps/prototype` imports from it.
- `src/components/decisions/CreateProcessWizard/` is a **copy** of real product
  code in `apps/app`. Changes here do not reach the product — if a wizard change
  should ship, make it in `apps/app` too and say so.

## Commands

```bash
pnpm -C apps/prototype dev      # http://localhost:3120
pnpm -C apps/prototype build    # dist/index.html + dist/artifact.html
```

Typecheck and format from this directory:

```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
npx oxfmt src/
```

Never start or kill the dev server on **:3100** — it is shared and managed
outside this worktree. This app owns **:3120** (`.claude/launch.json` →
`prototype-vite`).

## Conventions

- Prototype components are prefixed `Prototype*` and live flat in
  `src/components/prototype/`.
- Every prototype file opens with a `PROTOTYPE ONLY — delete with the rest of
  components/prototype` note. Keep it.
- Copy is plain English strings, not dictionary keys. `phaseCopy()` and
  `vocabulary()` in `store.ts` own anything that varies by phase or process type
  — put per-type copy there, not at the call site, and render it **without**
  `t()` (those strings are already interpolated, not keys).
- All of the root `CLAUDE.md` UI rules hold: prefer `@op/sense` components over
  vanilla elements, per-component imports, design tokens only, logical
  properties (`ms-`/`pe-`/`start-`), accessible names on icon-only controls.

## Traps that cost real time

- **This app compiles its own CSS — do not "fix" that.** `src/styles.css` does
  `@import '@op/styles/theme'` and runs Tailwind over it via
  `postcss.config.mjs`, rather than consuming `@op/styles`'s prebuilt
  `dist/styles.css`. That is deliberate: the prebuilt sheet makes a brand-new
  utility class silently do nothing until the package is rebuilt, and compiling
  here means Vite rebuilds on every change. It also means a clean CI build needs
  no `packages/styles` build step.
- **`cn()` merges conflicting utilities, and the later one wins.** Passing
  `relative` to a component that is `fixed` silently unpositions it. Passing a
  padding override to a component whose own padding comes from a `:has()`
  selector silently loses instead. Check the computed style, not the class list.
- **Absolutely positioned elements paint above static ones** regardless of DOM
  order. A connector line drawn behind circles needs the circles positioned too;
  `-z-10` is not the fix — it drops the element behind the page's background and
  it disappears entirely.
- **Keyframes override the class they sit on.** An `animation` that touches
  `opacity` beats an `opacity-*` utility for the whole run.
- **Dates are date-only strings** parsed to local noon (`parseDay`). Never
  `new Date('2026-09-05')` for display — it is UTC midnight and renders the day
  before, west of UTC.
- **The launch sequence depends on the phase card's two treatments being
  geometrically identical.** See HANDOFF §5 before touching the rail's cards.

## State

localStorage, key `op-prototype-processes`. Seeded processes in `store.ts` are
copy-on-write — the first edit copies one into storage. Reset with:

```js
localStorage.removeItem('op-prototype-processes');
```

Session-scoped flags (rail editing, return-to-current-phase) are in
`sessionStorage`; they survive navigation, not a new tab.

## Verifying a change

The Browser pane cannot drive dnd-kit: it throttles `requestAnimationFrame` in a
hidden pane, so drags never activate and timers run one tick per second, which
makes short animations look like they never ran. Use Playwright for anything
involving drag or animation timing, hover the drag handle first (handles are
`opacity-0` until hover), and move the mouse in steps rather than one jump.

Prefer measuring over eyeballing: computed styles, `getBoundingClientRect()`,
`document.getAnimations()`. Several bugs in this prototype's history were
"verified working" from a screenshot taken at the wrong moment.
