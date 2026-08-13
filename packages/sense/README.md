# @op/sense

The One Project design system: the components the app is built from, and the
rules that keep them coherent.

Sense is [shadcn/ui](https://ui.shadcn.com) in its **Base UI** style — the
components are generated from shadcn's registry, and underneath them sits
[Base UI](https://base-ui.com) rather than the legacy Radix build. Theming comes
from `@op/styles`, so a component looks like One Project without any component
file knowing what "One Project" looks like.

It replaces `@op/ui` (our fork of Intent UI, built on React Aria). **`apps/app`
no longer imports `@op/ui` at all**, and the dependency has been dropped from
both apps — an accidental `@op/ui` import is now a typecheck failure, not a
review comment. The package survives only to serve its own Storybook and the
side-by-side comparison surface, and is deleted once those go.

**Storybook is the component reference.** `pnpm w:sense dev` → http://localhost:3600.
Every component has stories, each one has an **A11y** panel running axe against
it live, and the props tables are generated from the source. Start there before
you read anything here.

---

## Why Base UI

Three properties we were missing:

- **Accessible by default.** Focus management, `aria-*` wiring, typeahead,
  roving tabindex, dismiss and scroll-lock behaviour are the library's job. We
  get them right by not implementing them.
- **Unstyled.** Base UI ships behaviour and no appearance, so our tokens are the
  only source of visual truth. There is no vendor theme to fight.
- **Server-component friendly.** `'use client'` sits on the primitives that need
  it, so a page composed of sense components can stay a server component.

The trade against React Aria: Base UI uses native DOM prop names (`disabled`,
`onClick`, `checked`) rather than RAC's (`isDisabled`, `onPress`, `isSelected`).
Less to memorise, and it composes with plain HTML.

## Structure

```
packages/sense/
├── .storybook/                    # Storybook + addon config
└── src/
    ├── components/
    │   ├── ui/                    # PRIMITIVES — generated, regenerable
    │   │   ├── button.tsx
    │   │   ├── button.stories.tsx
    │   │   └── …
    │   └── <Name>/                # COMPOSITES — hand-written
    │       ├── index.tsx
    │       └── index.stories.tsx
    ├── hooks/
    └── lib/utils.ts               # cn()
```

The split is the important part:

**Primitives** (`components/ui/`) come from the shadcn registry. They are
regenerable — `shadcn add <name>` can overwrite one — so they carry no product
knowledge and no OP-specific styling beyond semantic classes. Filenames are
kebab-case because that's what the CLI writes.

**Composites** (`components/<Name>/`) are ours. They compose primitives into
things the product needs (`ProposalCard`, `PhaseStepper`, `FacePile`) and they
are never overwritten by a tool.

Stories live next to the component they document, so a component and its docs
move, rename, and get deleted together.

## Using it

Import per component, via a PascalCase subpath:

```ts
import { Button } from '@op/sense/Button';
import { Dialog, DialogContent, DialogTrigger } from '@op/sense/Dialog';
import { ProposalCard } from '@op/sense/ProposalCard';
import { cn } from '@op/sense/lib/utils';
```

The subpath is decoupled from the on-disk filename, and every public component
has an explicit entry in `package.json#exports`. There is no barrel import —
`import { Button } from '@op/sense'` does not work, by design.

### `cn` comes from sense, not `@op/ui`

```ts
import { cn } from '@op/sense/lib/utils';
```

This `cn` registers our custom tokens with `tailwind-merge`. Stock `twMerge`
can't tell `text-title` (a size) from `text-primary` (a colour) and silently
drops the size when both appear in one merge; it also reads `font-strong` as a
font family, so `font-normal` never displaces it. Using the wrong `cn` produces
components that look right until someone passes a `className`.

## Styling

All design values live in `@op/styles`, in **two files**. (The package ships two
others: `intent-ui-theme.css` belongs to `@op/ui` and dies with it, and
`tw-animate.css` is vendored. Neither is a place to put a token.)

| File | Holds | Rule |
|---|---|---|
| `tokens.css` | Raw values — the colour ramps, radii, shadows, spacing, breakpoints straight out of Figma | Values only. A token here has no opinion about where it's used. |
| `theme.css` | Semantic names — `--primary`, `--background`, `--muted-foreground`, `--border`… mapped onto those raw values | Meaning only. This is the package entry point. |

The type scale is the one exception: `--text-label` through `--text-display` and
`--font-weight-strong` live in `theme.css`, not `tokens.css`, because their
responsive step-up is defined alongside them.

Components reference **semantic** classes — `bg-primary`, `text-muted-foreground`,
`border-input` — never raw tokens and never literal values. That indirection is
what lets a rebrand be a `theme.css` edit instead of a sweep.

Anything that already imports `@op/styles` gets sense theming for free. There is
no per-component CSS and no wrapper class to remember: the tokens live on
`:root`.

### Type scale

Four serif heading steps, plus one weight:

| Class | < 768px | ≥ 768px |
|---|---|---|
| `text-label` | 16px | 16px |
| `text-title` | 18px | 20px |
| `text-headline` | 20px | 30px |
| `text-display` | 24px | 48px |

`font-strong` is weight 450 — a real face in the variable font, between `normal`
and `medium`.

These are **serif headings**. Sans control labels (buttons, inputs, table
headers) use the generic Tailwind scale (`text-sm`, `text-base`) with default
tracking. Reaching for `text-label` on a button label is the common mistake.

Note the steps switch at `md` (768px), not `sm` (640px).

## Accessibility

Treated as a correctness property, not a polish pass.

**What you get for free.** Base UI owns focus trapping and restoration, roving
tabindex, typeahead, `aria-expanded`/`aria-controls`/`aria-selected` wiring,
dismiss behaviour, and scroll locking. Don't reimplement any of it, and don't
work around it — if a component fights you, the composition is usually wrong.

**What you still owe.** Four things the library cannot infer:

1. **An accessible name on every icon-only control.** `<Button size="icon-sm">`
   with only an icon inside is a nameless button. Pass `aria-label`.
2. **A real label on every input.** `Field` + `FieldLabel`, or `htmlFor`
   pointing at the control's `id`. A placeholder is not a label.
3. **Announcements for content that changes without a navigation.** Async
   results, counts, validation errors, save states — `aria-live="polite"`.
4. **Semantics for anything clickable that isn't a button or link.** A clickable
   card or row needs a real control inside it, not a click handler on a `div`.

**Colour and motion.** Use semantic tokens and contrast comes with them; a
hand-picked colour is where contrast failures enter. Anything that animates
needs a `motion-reduce:` branch.

**RTL.** Use logical properties everywhere — `ms-`/`me-`, `ps-`/`pe-`,
`start-`/`end-`, `text-start`/`text-end` — never `ml-`/`pl-`/`left-`. Directional
icons flip with `rtl:-scale-x-100`. The app ships Arabic; RTL is not
hypothetical.

**How it's checked.** Two layers, at different stages of maturity:

- **Component level** — the **A11y** panel in Storybook runs axe against the
  story you're looking at, live, as you build. Read it before you open a PR.
  Not yet enforced in CI: the headless gate (`@storybook/addon-vitest`) is
  blocked on an upstream Vite/ESM break between `@testing-library/dom` and
  `aria-query@5.3.0`, where `import { elementRoles }` resolves to nothing. It
  lands in its own PR once that clears.
- **Route level** — `pnpm a11y:baseline` runs axe over every committed route
  against `tests/e2e/a11y-baseline/known-violations.json`, and **is** enforced.
  See `tests/e2e/a11y-baseline/README.md`.

The route baseline is a punch-list, not an allow-list: an entry is debt to drive
to zero, and CI fails on a violation that isn't listed **and** on a listed one
that no longer fires. The component gate will work the same way, with a
per-story `parameters.a11y.test` opt-out standing in for the JSON list.

## Storybook

```bash
pnpm w:sense dev      # http://localhost:3600
pnpm w:sense build    # static build
```

On a fresh clone, run `pnpm build` once first. `@op/styles` resolves to a
generated `dist/styles.css`, and these scripts call Storybook directly rather
than through turbo, so without it you get
`Failed to resolve entry for package "@op/styles"`. CI builds via
`turbo build --filter=@op/sense`, which compiles the dependency first.

Every story has to compile and bundle, so the build is the current CI check.
Stories are meant to become the test suite too — rendered headless with axe on
each — which is what the blocked `@storybook/addon-vitest` gate above will add.

`@op/ui`'s Storybook still exists on port 3601 (`pnpm w:ui dev`) and carries the
side-by-side `@op/ui` ↔ `@op/sense` comparison. It goes away with `@op/ui`.

## Adding a component

Both recipes are written out for agents in [`CLAUDE.md`](./CLAUDE.md); the short
version:

**A primitive** — run `shadcn add <component>` from this package (the app has no
shadcn config, by design, so primitives can't land outside the design system),
add a `package.json#exports` entry, write a story. Never edit a primitive to use
OP tokens directly; if it looks wrong, the fix is in `theme.css`.

**A composite** — hand-write `src/components/<Name>/index.tsx` composing
primitives via relative imports, add the exports entry, write a story.

Forgetting the exports entry gives consumers a clear
`Cannot find module '@op/sense/<Name>'` — that's the drift signal.

## The `Chart` build warning

Building anything that imports `Chart` prints:

```
"setUseStrictIteration" is not exported by immer/dist/immer.mjs
```

It is a **warning, not a failure** — Rollup builds through it, and nothing
breaks at runtime, because `@reduxjs/toolkit` imports that binding and never
calls it (zero call sites in its `modern` and `browser` bundles). A binding
that is never dereferenced cannot throw.

It still matters, because **esbuild treats it as a hard error**. Any
esbuild-based tooling in this package's graph — notably the
`@storybook/addon-vitest` a11y gate — fails outright rather than warning.

Why the version is wrong: `pnpm.overrides` in the root `package.json` maps
`immer` to `$immer`, which resolves to the root's own declaration. That forces
**one** `immer` on every consumer in the monorepo. `recharts` (which `Chart`
wraps) depends on `@reduxjs/toolkit@2.12`, which declares `immer: ^11`, so the
override drags RTK down to the root's `^10.1.1` — and
`setUseStrictIteration` did not exist until **10.2.0**.

The fix is a one-line bump of the root pin to `^10.2.0`, not a move to v11:

- `setUseStrictIteration` shipped in 10.2.0 (2025-10-25), a month *before*
  11.0.0 — it is the opt-in flag added ahead of v11 making strict iteration the
  default. Calling it on 10.2.0 does exactly what RTK intends.
- 10.2.0 satisfies `recharts`' own `^10.1.1`, so it stays inside its declared
  range. Forcing v11 would push `recharts` outside it.
- It keeps a single `immer`. Letting RTK and `recharts` resolve separate majors
  risks a draft created by one copy failing the other copy's `isDraft` — and
  `recharts` drives RTK's store, so drafts do cross that boundary.

Nothing in any workspace imports `immer` (`zustand`'s `immer` peer is optional
and we don't use its middleware), so the root declaration exists only to feed
the override.

## Known upstream patches

These primitives differ from unmodified registry output because shadcn's
published source lags its declared dependency versions. Reapply if you re-run
`shadcn add` for them:

- `calendar.tsx` — removed the `table:` `className` entry. `react-day-picker`
  v10 dropped `table` from its `ClassNames` type; the registry still emits it.
- `scroll-area.tsx` — dropped an unused `import * as React from "react"` that
  fails `noUnusedLocals`.
