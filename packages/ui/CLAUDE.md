# `@op/ui` — shadcn / Taki migration notes

`@op/ui` is built on shadcn components ported to react-aria-components by
Taki UI (https://taki-ui.com). Tokens follow the canonical shadcn names
(`--background`, `--primary`, `--destructive`, etc.) declared via
`@theme inline` in `packages/styles/shadcn-theme.css`. Only `--primary`
/ `--ring` / `--sidebar-primary` are overridden to OP teal; semantic
extensions `--positive`, `--warning`, `--info` (plus `*-subtle` /
`*-subtle-fg` partners) live in the same file.

## Adding or refreshing a Taki component

1. **Pull from the registry.** Use the helper:
   ```bash
   node scripts/pullTaki.mjs <name> [<name> ...]
   ```
   Components land in `packages/ui/src/components/ui/{name}.tsx`. The
   script logs npm deps it sees — install missing ones with
   `pnpm add --filter @op/ui <pkg>`.

2. **Rewrite aliased imports.** Taki ships imports against
   `@/lib/utils` / `@/registry/new-york/ui/X`. Run:
   ```bash
   node scripts/fixTakiPaths.mjs
   ```
   to rewrite them to the relative paths our layout uses.

3. **Beware of overwrites.** The pull is destructive — any local edits
   to a primitive (e.g. our shadcn-faithful `Button`) get replaced. Save
   the diff before pulling and re-apply afterwards.

4. **Type-check.** `pnpm w:ui typecheck`. If a vendored file ships with
   real type errors against tsgo (Taki occasionally lags react-aria-
   components or recharts type updates), prefix it with
   `// @ts-nocheck — vendored Taki registry file with type-strictness
   mismatches` and open a follow-up issue. The current `@ts-nocheck`
   files are: chart, carousel, command, sidebar, tree, slider,
   range-calendar, search-field, text-field, input-group,
   toggle-button-group, date-picker.

5. **Add a story.** Drop a smoke story under `packages/ui/stories/`
   so a future re-pull can't regress visuals invisibly.

## Token classes

- Use shadcn names: `bg-background`, `text-foreground`,
  `text-muted-foreground`, `bg-accent`, `bg-primary`,
  `text-primary-foreground`, `bg-destructive`, `text-destructive`,
  `bg-positive`, `text-positive`, `bg-warning`, `text-warning`, etc.
- The `-fg` short aliases (e.g. `text-muted-fg`, `text-primary-fg`)
  exist as conveniences for vendored Taki files. Prefer the canonical
  `-foreground` names in new code.
- `bg-primary-foreground` is the *text color rendered on top of
  `--primary`* — do **not** use it as a panel background. For a soft
  pale-teal panel use `bg-primary/10`.
- The OP brand class names (`text-primary-teal`, `bg-neutral-gray1`,
  `text-functional-red`, etc.) are gone. The class-swap codemod that
  retired them is at `scripts/swapTokens.mjs`.

## Legacy wrappers vs vendored primitives

Each `packages/ui/src/components/X.tsx` is one of:
- A re-export of `./ui/x` (the vendored Taki primitive).
- A thin wrapper that adds OP-specific behavior (Button isLoading
  spinner, IconButton size aliases, Tooltip default delay, etc.).
- A bespoke OP component built on RAC primitives (Sidebar,
  RichTextEditor, Sortable, AlertBanner, etc.) — these own their
  own styles and should use shadcn token classes throughout.

`packages/ui/src/components/ui/data-table.tsx` is OP-owned RAC code
(preserved from the Intent migration), not a Taki vendor file. Treat
it as first-class — it should not carry `@ts-nocheck` and should
typecheck.

## Workflow rules

- Run `pnpm w:ui typecheck` after every change; do not commit failing.
- Run `pnpm w:app typecheck` after touching anything in `./components/*.tsx`
  (consumers may break if you tighten or rename a prop).
- Use design tokens — never arbitrary Tailwind values like
  `text-[14px]` or `bg-[#333]`.
- Custom type scale (`text-title-lg`, `text-title-xxs`, etc.) and the
  OP body scale (`text-xs`=10, `text-sm`=12, `text-base`=14, `text-lg`=16)
  are intentional; don't migrate them.
