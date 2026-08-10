# @op/sense

[shadcn/ui](https://ui.shadcn.com) components for the OP monorepo, using the
**`base-vega`** style — shadcn's [Base UI](https://base-ui.com) variant (not
the legacy Radix variant).

This package sits alongside `@op/ui` (the customized Intent UI library) and
is intended to **eventually replace** it. Its layout, conventions, and
public-API shape intentionally mirror `@op/ui` so migration between the two
is mechanical.

## Layout

```
src/
├── components/
│   ├── ui/                # vanilla shadcn primitives (regenerable, do-not-edit)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   └── <Composite>.tsx    # hand-written compositions (none yet)
├── hooks/
├── lib/
│   └── utils.ts
└── styles.css             # CLI scratchpad (do not import)
```

Primitives belong in `components/ui/`. Anything we hand-write that composes
primitives goes one level up in `components/` so the on-disk shape encodes
the regenerable / non-regenerable distinction.

## Usage

Consumers import per-component via PascalCase subpaths — the same shape as
`@op/ui`:

```ts
import { Button } from '@op/sense/Button';
import { Dialog, DialogContent, DialogTrigger } from '@op/sense/Dialog';
import { Combobox } from '@op/sense/Combobox';
import { useIsMobile } from '@op/sense/hooks/use-mobile';
import { cn } from '@op/sense/lib/utils';
```

The subpath name is decoupled from the on-disk filename (which is
lowercased / kebab-case because that's what shadcn writes). Each public
component has an explicit entry in `package.json#exports`.

## Theming

Shadcn's semantic CSS variables (`--background`, `--foreground`, `--primary`,
etc.) are mapped onto OP brand tokens in
[`packages/styles/sense-theme.css`](../styles/sense-theme.css), which is
imported by `@op/styles/shared-styles.css`. Apps that already consume
`@op/styles` get sense theming for free — no extra CSS import needed.

To rebrand a semantic role (e.g. change what `--primary` resolves to), edit
`sense-theme.css`. Do **not** edit individual component files.

## Adding a new shadcn component

```bash
cd packages/sense
pnpm dlx shadcn@latest add <component>
```

The CLI uses `components.json`'s default `@/`-style aliases, writes to
`src/components/ui/<component>.tsx`, and emits imports like
`import { cn } from "@/lib/utils"` — which resolve fine inside the package
via the `@/* → ./src/*` tsconfig path.

After running it, **add an entry to `package.json#exports`**:

```jsonc
"./<PascalName>": "./src/components/ui/<filename>.tsx"
```

If you forget, consumers will get a clear `Cannot find module
'@op/sense/<PascalName>'` error from TypeScript — that's our drift signal.

`components.json` sets `"rtl": true`, so the CLI writes logical classes
(`ms-`/`me-`, `start-`/`end-`) instead of physical ones and adds `rtl:` variants
where no logical equivalent exists. It cannot do everything:

- **Calendar, Pagination and Sidebar** are on shadcn's manual list. Sidebar in
  particular keys physical positions off a physical `side`, so a blind rename
  breaks the pair.
- **Rotated elements** keep physical corners — `rounded-tl` on a `rotate-45`
  arrow is its tip, and `rounded-ss` moves the rounding to a side in RTL.
- **`space-x-*`** needs nothing: v4 already emits `margin-inline-end`. The CLI's
  `rtl:space-x-reverse` rule is a v3 holdover and *introduces* a bug here.
- **Icons** are only flipped if they carry the `cn-rtl-flip` marker. Ours use
  `rtl:-scale-x-100` directly; keep to that spelling.

Run it from this package only — the app has no shadcn config, by design, so new
primitives can't land outside the design system.

## Internal imports

Inside the package, components import each other via **relative paths**, not
package-qualified ones:

```ts
// inside src/components/ui/sheet.tsx
import { Button } from './button';
import { cn } from '../../lib/utils';
```

This matches `@op/ui`'s convention and avoids the casing mismatch between
shadcn's lowercase filenames and our PascalCase public subpaths.

## Adding a composite

Drop a hand-written file in `src/components/<Name>.tsx`, then add its export
entry. The file can import shadcn primitives relatively from `./ui/<x>` or
publicly via `@op/sense/<X>` — but stick to relative inside the package so
internal restructuring doesn't require touching the public API:

```tsx
// src/components/ConfirmDialog.tsx
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
```

## Known upstream patches

The following components have minimal patches against the unmodified
registry output because shadcn's published source lags behind its declared
dependency versions:

- `calendar.tsx` — removed the `table:` className entry. `react-day-picker`
  v10 removed `table` from its `ClassNames` type, but the registry still
  emits it.
- `scroll-area.tsx` — dropped an unused `import * as React from "react"`
  that fails `noUnusedLocals`.

If you re-run `shadcn add` for these components, reapply the same patches.

## Conventions

- Do **not** edit primitives in `components/ui/` to use OP tokens directly.
  Use the semantic shadcn classes (`bg-primary`, `text-muted-foreground`,
  etc.) and let the theme mapping do the work.
- Do **not** add `@op/sense` as a runtime dependency to anything inside
  this package — it's a leaf.
- New public components require a matching `package.json#exports` entry.
  No automation — `@op/ui` does the same and has lived with it for ~80
  components.
