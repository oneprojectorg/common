---
name: shadcn
description: Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composing UI. Provides project context, component docs, and usage examples. Applies when working with shadcn/ui, component registries, presets, --preset codes, or any project with a components.json file. Also triggers for "shadcn init", "create an app with --preset", or "switch to --preset".
user-invocable: false
allowed-tools: Bash(pnpm dlx shadcn@latest *), Bash(pnpm dlx shadcn@latest *), Bash(bunx --bun shadcn@latest *)
---

# shadcn/ui

A framework for building ui, components and design systems. Components are added as source code to the user's project via the CLI.

> **IMPORTANT:** This repo is pnpm-only. Always run CLI commands as `pnpm dlx shadcn@latest`. Never use `npx`.

## OP project context

This monorepo has **two** UI packages — know which one you are touching:

- **`@op/ui`** (legacy) — Custom Intent UI / React Aria. Existing app surfaces use this. Per `CLAUDE.md`, prefer it over vanilla html in any unmigrated code path. Do NOT run `shadcn add` against this package.
- **`@op/ui-next`** (shadcn migration target) — Run all shadcn commands from this workspace: `pnpm w:ui-next ...` or `cd packages/ui-next && pnpm dlx shadcn@latest ...`. Registry alias `@shadcn-base` resolves to base-nova. `components.json` lives here.

Naming drift to know:
- Ports in `packages/ui-next/src/components/` often keep `@op/ui` names instead of shadcn names — e.g. `Modal.tsx` is the Dialog port, `Sheet.tsx` parallels Modal. Search `packages/ui-next/src/components/` before running `add` to avoid duplicating a port under a different name.
- `Field.ts` re-exports the shadcn `field` family from `./ui/field` — consumers import composite Field surfaces from `@op/ui-next/Field`. `InputGroup` here means shadcn `InputGroup`, not the legacy `@op/ui` bordered wrapper of the same name.

Stack constraints that apply to every change:

- **Base only, no radix.** Our `components.json` is configured for base-nova (`registries.@shadcn-base` → base-nova registry). Never `add` from a radix registry. When the skill says "use `asChild` (radix) or `render` (base)", always pick `render`. See [rules/base-vs-radix.md](./rules/base-vs-radix.md).
- **Tokens — two namespaces, both valid in the app:**
  - **Shadcn tokens (`bg-primary`, `text-muted-foreground`, `bg-background`, `bg-card`, `border-border`, etc.)** — defined by the `@theme inline` block in `packages/ui-next/src/styles.css`. The base values ship as stock zinc, but `apps/app/src/app/layout.tsx` imports `@op/styles` AFTER `@op/ui-next/styles.css`, and `packages/styles/intent-ui-theme.css` re-declares `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--input`, `--ring` to op teal/neutrals. So **in the running app**, shadcn class names render with op colors. **In isolation (Storybook for ui-next, tests without `@op/styles`)** they render zinc. When in doubt, verify in the app.
  - **OP classes (`bg-neutral-gray1`, `text-primary-teal`, `bg-neutral-offWhite`)** — defined in `packages/styles/tokens.css` + `shared-styles.css`. Use these in legacy `@op/ui` / `apps/app/` code that does not consume ui-next.
  - **Inside `packages/ui-next/`**: prefer shadcn tokens, matching upstream shadcn examples. They will theme correctly in the app via the cascade.
  - **Raw Tailwind colors (`bg-blue-500`, `text-emerald-600`) are banned everywhere.**
- **Type scale** — use defined scale (`text-title-lg`, `text-sm`, etc.) from `packages/styles/shared-styles.css`. Do NOT use raw Tailwind size utilities we have not defined.
- **i18n** — every user-facing string must be wrapped: `t('...')` in client components, `<TranslatedText>` in server components. Adding components from registries without wrapping their strings is a bug.
- **No `any`, no `as`** — per project lint rules.

## Current Project Context

```json
!`pnpm dlx shadcn@latest info --json`
```

The JSON above contains the project config and installed components. Use `pnpm dlx shadcn@latest docs <component>` to get documentation and example URLs for any component.

## Principles

1. **Check `@op/ui-next` first, then `@op/ui`, then registries.** Before writing custom UI or running `add`, list `packages/ui-next/src/components/` and check `@op/ui` exports. Only then `pnpm dlx shadcn@latest search`.
2. **Compose, don't reinvent.** Settings page = Tabs + Card + form controls. Dashboard = Sidebar + Card + Chart + Table.
3. **Use built-in variants before custom styles.** `variant="outline"`, `size="sm"`, etc.
4. **Pick the right token namespace.** Inside `packages/ui-next/` use shadcn tokens (`bg-primary`, `text-muted-foreground`, `bg-background`) — they are aliased in `ui-next/src/styles.css`. Inside legacy `@op/ui` / `apps/app` code use op classes (`bg-neutral-gray1`, `text-primary-teal`). Never raw Tailwind colors (`bg-blue-500`) anywhere.
5. **Use the op type scale.** `text-title-lg`, `text-sm`, etc., defined in `packages/styles/shared-styles.css`. Never a raw Tailwind size class we have not aliased.
6. **Wrap user-facing strings.** Client: `const t = useTranslations(); t('...')`. Server: `<TranslatedText>`. Strings imported from registry blocks must be wrapped before merging.

## Critical Rules

These rules are **always enforced**. Each links to a file with Incorrect/Correct code pairs.

### Styling & Tailwind → [styling.md](./rules/styling.md)

- **`className` for layout, not styling.** Never override component colors or typography.
- **No `space-x-*` or `space-y-*`.** Use `flex` with `gap-*`. For vertical stacks, `flex flex-col gap-*`.
- **Use `size-*` when width and height are equal.** `size-10` not `w-10 h-10`.
- **Use `truncate` shorthand.** Not `overflow-hidden text-ellipsis whitespace-nowrap`.
- **No manual `dark:` color overrides.** Tokens (shadcn inside ui-next, op-classes elsewhere) handle light/dark via CSS variables. Never `bg-white dark:bg-gray-950`.
- **Use `cn()` for conditional classes.** Don't write manual template literal ternaries.
- **No manual `z-index` on overlay components.** Dialog, Sheet, Popover, etc. handle their own stacking.

### Forms & Inputs → [forms.md](./rules/forms.md)

- **Forms use `FieldGroup` + `Field`.** Never use raw `div` with `space-y-*` or `grid gap-*` for form layout.
- **`InputGroup` uses `InputGroupInput`/`InputGroupTextarea`.** Never raw `Input`/`Textarea` inside `InputGroup`.
- **Buttons inside inputs use `InputGroup` + `InputGroupAddon`.**
- **Option sets (2–7 choices) use `ToggleGroup`.** Don't loop `Button` with manual active state.
- **`FieldSet` + `FieldLegend` for grouping related checkboxes/radios.** Don't use a `div` with a heading.
- **Field validation uses `data-invalid` + `aria-invalid`.** `data-invalid` on `Field`, `aria-invalid` on the control. For disabled: `data-disabled` on `Field`, `disabled` on the control.

### Component Structure → [composition.md](./rules/composition.md)

- **Items always inside their Group.** `SelectItem` → `SelectGroup`. `DropdownMenuItem` → `DropdownMenuGroup`. `CommandItem` → `CommandGroup`.
- **Use `asChild` (radix) or `render` (base) for custom triggers.** Check `base` field from `pnpm dlx shadcn@latest info`. → [base-vs-radix.md](./rules/base-vs-radix.md)
- **Dialog, Sheet, and Drawer always need a Title.** `DialogTitle`, `SheetTitle`, `DrawerTitle` required for accessibility. Use `className="sr-only"` if visually hidden.
- **Use full Card composition.** `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`. Don't dump everything in `CardContent`.
- **Button has no `isPending`/`isLoading`.** Compose with `Spinner` + `data-icon` + `disabled`.
- **`TabsTrigger` must be inside `TabsList`.** Never render triggers directly in `Tabs`.
- **`Avatar` always needs `AvatarFallback`.** For when the image fails to load.

### Use Components, Not Custom Markup → [composition.md](./rules/composition.md)

- **Use existing components before custom markup.** Check if a component exists before writing a styled `div`.
- **Callouts use `Alert`.** Don't build custom styled divs.
- **Empty states use `Empty`.** Don't build custom empty state markup.
- **Toast via `sonner`.** Use `toast()` from `sonner`.
- **Use `Separator`** instead of `<hr>` or `<div className="border-t">`.
- **Use `Skeleton`** for loading placeholders. No custom `animate-pulse` divs.
- **Use `Badge`** instead of custom styled spans.

### Icons → [icons.md](./rules/icons.md)

- **Icons in `Button` use `data-icon`.** `data-icon="inline-start"` or `data-icon="inline-end"` on the icon.
- **No sizing classes on icons inside components.** Components handle icon sizing via CSS. No `size-4` or `w-4 h-4`.
- **Pass icons as objects, not string keys.** `icon={CheckIcon}`, not a string lookup.

### CLI

- **Never decode preset codes or build preset URLs manually.** Use `pnpm dlx shadcn@latest preset decode <code>`, `preset url <code>`, or `preset open <code>`. For project-aware preset detection, use `pnpm dlx shadcn@latest preset resolve`.
- **Apply preset codes directly with the CLI.** Use `pnpm dlx shadcn@latest apply <code>` for existing projects, or `pnpm dlx shadcn@latest init --preset <code>` when initializing.

## Key Patterns

These are the most common patterns that differentiate correct shadcn/ui code. For edge cases, see the linked rule files above.

```tsx
// Form layout: FieldGroup + Field, not div + Label.
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" />
  </Field>
</FieldGroup>

// Validation: data-invalid on Field, aria-invalid on the control.
<Field data-invalid>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid />
  <FieldDescription>Invalid email.</FieldDescription>
</Field>

// Icons in buttons: data-icon, no sizing classes.
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

// Spacing: gap-*, not space-y-*.
<div className="flex flex-col gap-4">  // correct
<div className="space-y-4">           // wrong

// Equal dimensions: size-*, not w-* h-*.
<Avatar className="size-10">   // correct
<Avatar className="w-10 h-10"> // wrong

// Status colors: Badge variants or token classes, not raw colors.
<Badge variant="secondary">+20.1%</Badge>                  // correct
<span className="text-destructive">-3.2%</span>            // correct inside ui-next (shadcn token)
<span className="text-primary-teal">…</span>               // correct in legacy code (op token)
<span className="text-emerald-600">+20.1%</span>           // wrong (raw Tailwind, banned everywhere)
```

## Component Selection

> **Check `packages/ui-next/src/components/` first.** Many shadcn primitives are already ported under op names: Dialog → `Modal.tsx`, plus `Sheet.tsx`, `Avatar.tsx`, `Button.tsx`, `Input.tsx`, `Select.tsx`, `Checkbox.ts`, `RadioGroup.ts`, `Menu.ts`, `Field.ts`, `Separator.tsx`, `Skeleton.tsx`, `Breadcrumbs.tsx`, `Pagination.tsx`, etc. Re-add only if missing.

| Need                       | Use                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Button/action              | `Button` with appropriate variant                                                                   |
| Form inputs                | `Input`, `Select`, `Combobox`, `Switch`, `Checkbox`, `RadioGroup`, `Textarea`, `InputOTP`, `Slider` |
| Toggle between 2–5 options | `ToggleGroup` + `ToggleGroupItem`                                                                   |
| Data display               | `Table`, `Card`, `Badge`, `Avatar`                                                                  |
| Navigation                 | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination`                                     |
| Overlays                   | `Dialog` (modal), `Sheet` (side panel), `Drawer` (bottom sheet), `AlertDialog` (confirmation)       |
| Feedback                   | `sonner` (toast), `Alert`, `Progress`, `Skeleton`, `Spinner`                                        |
| Command palette            | `Command` inside `Dialog`                                                                           |
| Charts                     | `Chart` (wraps Recharts)                                                                            |
| Layout                     | `Card`, `Separator`, `Resizable`, `ScrollArea`, `Accordion`, `Collapsible`                          |
| Empty states               | `Empty`                                                                                             |
| Menus                      | `DropdownMenu`, `ContextMenu`, `Menubar`                                                            |
| Tooltips/info              | `Tooltip`, `HoverCard`, `Popover`                                                                   |

## Key Fields

The injected project context contains these key fields:

- **`aliases`** → use the actual alias prefix for imports (e.g. `@/`, `~/`), never hardcode.
- **`isRSC`** → when `true`, components using `useState`, `useEffect`, event handlers, or browser APIs need `"use client"` at the top of the file. Always reference this field when advising on the directive.
- **`tailwindVersion`** → `"v4"` uses `@theme inline` blocks; `"v3"` uses `tailwind.config.js`.
- **`tailwindCssFile`** → the global CSS file where custom CSS variables are defined. Always edit this file, never create a new one.
- **`style`** → component visual treatment (e.g. `nova`, `vega`).
- **`base`** → primitive library (`radix` or `base`). Affects component APIs and available props.
- **`iconLibrary`** → determines icon imports. Use `lucide-react` for `lucide`, `@tabler/icons-react` for `tabler`, etc. Never assume `lucide-react`.
- **`resolvedPaths`** → exact file-system destinations for components, utils, hooks, etc.
- **`framework`** → routing and file conventions (e.g. Next.js App Router vs Vite SPA).
- **`packageManager`** → use this for any non-shadcn dependency installs (e.g. `pnpm add date-fns` vs `npm install date-fns`).
- **`preset`** → resolved preset code and values for the current project. Use `pnpm dlx shadcn@latest preset resolve --json` when you only need preset information.

See [cli.md — `info` command](./cli.md) for the full field reference.

## Component Docs, Examples, and Usage

Run `pnpm dlx shadcn@latest docs <component>` to get the URLs for a component's documentation, examples, and API reference. Fetch these URLs to get the actual content.

```bash
pnpm dlx shadcn@latest docs button dialog select
```

**When creating, fixing, debugging, or using a component, always run `pnpm dlx shadcn@latest docs` and fetch the URLs first.** This ensures you're working with the correct API and usage patterns rather than guessing.

## Workflow

1. **Get project context** — already injected above. Run `pnpm dlx shadcn@latest info` again if you need to refresh.
2. **Check installed components first** — before running `add`, always check the `components` list from project context or list the `resolvedPaths.ui` directory. Don't import components that haven't been added, and don't re-add ones already installed.
3. **Find components** — `pnpm dlx shadcn@latest search`.
4. **Get docs and examples** — run `pnpm dlx shadcn@latest docs <component>` to get URLs, then fetch them. Use `pnpm dlx shadcn@latest view` to browse registry items you haven't installed. To preview changes to installed components, use `pnpm dlx shadcn@latest add --diff`.
5. **Install or update** — `pnpm dlx shadcn@latest add`. When updating existing components, use `--dry-run` and `--diff` to preview changes first (see [Updating Components](#updating-components) below).
6. **Fix imports in third-party components** — After adding components from community registries (e.g. `@bundui`, `@magicui`), check the added non-UI files for hardcoded import paths like `@/components/ui/...`. These won't match the project's actual aliases. Use `pnpm dlx shadcn@latest info` to get the correct `ui` alias (e.g. `@workspace/ui/components`) and rewrite the imports accordingly. The CLI rewrites imports for its own UI files, but third-party registry components may use default paths that don't match the project.
7. **Review added components** — After adding a component or block from any registry, **always read the added files and verify they are correct**. Check for missing sub-components (e.g. `SelectItem` without `SelectGroup`), missing imports, incorrect composition, or violations of the [Critical Rules](#critical-rules). Also replace any icon imports with the project's `iconLibrary` from the project context (e.g. if the registry item uses `lucide-react` but the project uses `hugeicons`, swap the imports and icon names accordingly). Fix all issues before moving on.
8. **Registry must be explicit** — When the user asks to add a block or component, **do not guess the registry**. If no registry is specified (e.g. user says "add a login block" without specifying `@shadcn`, `@tailark`, etc.), ask which registry to use. Never default to a registry on behalf of the user.
9. **Switching presets** — Ask the user first: **overwrite**, **partial**, **merge**, or **skip**?
   - **Inspect current preset**: `pnpm dlx shadcn@latest preset resolve`. Use `--json` when you need structured values.
   - **Inspect incoming preset**: `pnpm dlx shadcn@latest preset decode <code>`. Use `preset url <code>` or `preset open <code>` to share or open the preset builder.
   - **Overwrite**: `pnpm dlx shadcn@latest apply <code>`. Overwrites detected components, fonts, and CSS variables.
   - **Partial**: `pnpm dlx shadcn@latest apply <code> --only theme,font`. Updates only the selected preset parts without reinstalling UI components. Supported values are `theme` and `font`; comma-separated combinations are allowed. `icon` is intentionally not supported, because icon changes may require full component reinstall and transforms.
   - **Merge**: `pnpm dlx shadcn@latest init --preset <code> --force --no-reinstall`, then run `pnpm dlx shadcn@latest info` to list installed components, then for each installed component use `--dry-run` and `--diff` to [smart merge](#updating-components) it individually.
   - **Skip**: `pnpm dlx shadcn@latest init --preset <code> --force --no-reinstall`. Only updates config and CSS, leaves components as-is.
   - **Important**: Always run preset commands inside the user's project directory. `apply` only works in an existing project with a `components.json` file. The CLI automatically preserves the current base (`base` vs `radix`) from `components.json`. If you must use a scratch/temp directory (e.g. for `--dry-run` comparisons), pass `--base <current-base>` explicitly — preset codes do not encode the base.

## Updating Components

When the user asks to update a component from upstream while keeping their local changes, use `--dry-run` and `--diff` to intelligently merge. **NEVER fetch raw files from GitHub manually — always use the CLI.**

1. Run `pnpm dlx shadcn@latest add <component> --dry-run` to see all files that would be affected.
2. For each file, run `pnpm dlx shadcn@latest add <component> --diff <file>` to see what changed upstream vs local.
3. Decide per file based on the diff:
   - No local changes → safe to overwrite.
   - Has local changes → read the local file, analyze the diff, and apply upstream updates while preserving local modifications.
   - User says "just update everything" → use `--overwrite`, but confirm first.
4. **Never use `--overwrite` without the user's explicit approval.**

## Quick Reference

```bash
# Create a new project.
pnpm dlx shadcn@latest init --name my-app --preset base-nova
pnpm dlx shadcn@latest init --name my-app --preset a2r6bw --template vite

# Create a monorepo project.
pnpm dlx shadcn@latest init --name my-app --preset base-nova --monorepo
pnpm dlx shadcn@latest init --name my-app --preset base-nova --template next --monorepo

# Initialize existing project.
pnpm dlx shadcn@latest init --preset base-nova
pnpm dlx shadcn@latest init --defaults  # shortcut: --template=next --preset=nova (base style implied)

# Apply a preset to an existing project.
pnpm dlx shadcn@latest apply a2r6bw
pnpm dlx shadcn@latest apply a2r6bw --only theme
pnpm dlx shadcn@latest apply a2r6bw --only font
pnpm dlx shadcn@latest apply a2r6bw --only theme,font

# Inspect preset codes and project preset state.
pnpm dlx shadcn@latest preset decode a2r6bw
pnpm dlx shadcn@latest preset url a2r6bw
pnpm dlx shadcn@latest preset open a2r6bw
pnpm dlx shadcn@latest preset resolve
pnpm dlx shadcn@latest preset resolve --json

# Add components.
pnpm dlx shadcn@latest add button card dialog
pnpm dlx shadcn@latest add @magicui/shimmer-button
pnpm dlx shadcn@latest add --all

# Preview changes before adding/updating.
pnpm dlx shadcn@latest add button --dry-run
pnpm dlx shadcn@latest add button --diff button.tsx
pnpm dlx shadcn@latest add @acme/form --view button.tsx

# Search registries.
pnpm dlx shadcn@latest search @shadcn -q "sidebar"
pnpm dlx shadcn@latest search @tailark -q "stats"

# Get component docs and example URLs.
pnpm dlx shadcn@latest docs button dialog select

# View registry item details (for items not yet installed).
pnpm dlx shadcn@latest view @shadcn/button
```

**Named presets:** `nova`, `vega`, `maia`, `lyra`, `mira`, `luma`
**Templates:** `next`, `vite`, `start`, `react-router`, `astro` (all support `--monorepo`) and `laravel` (not supported for monorepo)
**Preset codes:** Version-prefixed base62 strings (e.g. `a2r6bw` or `b0`), from [ui.shadcn.com](https://ui.shadcn.com).

## Detailed References

- [rules/forms.md](./rules/forms.md) — FieldGroup, Field, InputGroup, ToggleGroup, FieldSet, validation states
- [rules/composition.md](./rules/composition.md) — Groups, overlays, Card, Tabs, Avatar, Alert, Empty, Toast, Separator, Skeleton, Badge, Button loading
- [rules/icons.md](./rules/icons.md) — data-icon, icon sizing, passing icons as objects
- [rules/styling.md](./rules/styling.md) — Semantic colors, variants, className, spacing, size, truncate, dark mode, cn(), z-index
- [rules/base-vs-radix.md](./rules/base-vs-radix.md) — asChild vs render, Select, ToggleGroup, Slider, Accordion
- [cli.md](./cli.md) — Commands, flags, presets, templates
- [customization.md](./customization.md) — Theming, CSS variables, extending components
