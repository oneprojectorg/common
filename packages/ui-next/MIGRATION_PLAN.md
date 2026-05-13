# @op/ui → @op/ui-next (shadcn base-nova) Migration Plan

Migrate `@op/ui` (68 components, react-aria-components + custom) to a new `@op/ui-next` package built on shadcn's `base-nova` registry (Base UI + Tailwind v4). Component-by-component, multi-PR rollout. Delete `@op/ui` at the end.

## Stack decisions (locked)

| Concern | Decision |
|---|---|
| New package | `@op/ui-next` at `packages/ui-next/` |
| Primitives | `@base-ui/react/*` only (no Radix) |
| Registry | `https://ui.shadcn.com/r/styles/base-nova/{name}.json` under `@shadcn-base` namespace in `components.json` |
| Theme | shadcn base-nova defaults first; re-theme to `--op-*` tokens in Phase 5 |
| Tailwind | v4 (already on it) |
| Icons | Keep `react-icons/lu`; rewrite `lucide-react` imports via `scripts/rewrite-icons.mjs` after every `shadcn add` |
| Forms | Keep `@tanstack/react-form` wrapper at `apps/app/src/components/form/utils.tsx`; swap inner widgets only |
| Storybook | New Storybook in `@op/ui-next` on port 6007; stories added per-component |
| Custom components (no shadcn equivalent) | Port to `@op/ui-next`, restyle to shadcn defaults |
| Aria wiring | Match shadcn (consumer wires `htmlFor`/`aria-describedby`); our wrappers call `useId()` internally so caller DX is unchanged |
| Modal | Compat wrapper around shadcn `Dialog` exposing existing `OverlayTriggerStateContext` + render-prop `close`. Do NOT codemod 52 call sites. |
| `FieldGroup` rename | Adopt shadcn's `input-group` directly; our old `FieldGroup` becomes `InputGroup` |
| `Select selectionMode="multiple"` | Route to `MultiSelectComboBox`, not `Select` |
| `apps/api` | Confirmed: zero `@op/ui` imports (false positive in earlier grep) |
| RAC/RAH/RAS passthrough | 15 files import RAC through `@op/ui/RAC|RAH|RAS`. Migrate to direct `react-aria-components` imports in Phase 6. |
| Branches | Stacked sub-branches off `shadcn-full-install` integration branch (`shadcn/00-foundation`, `shadcn/01-field-tier`, etc.). Only `shadcn-full-install` lands to `dev`. |
| PR cadence | 2–5 components per PR |
| Codemod | `rg -l '@op/ui/Foo' apps \| xargs sed -i '' -e 's\|@op/ui/Foo\|@op/ui-next/foo\|g'` per PR + hand-fix prop drift |
| MIGRATION_PLAN.md | Lives at `packages/ui-next/MIGRATION_PLAN.md`. Updated each PR. |
| App import of ui-next styles.css | From Phase 0. Base-nova `@theme` block in `@op/ui-next/src/styles.css`; app `globals.css` adds `@import "@op/ui-next/styles.css"` (eng-review #1). |
| Storybook | v10 (latest), port 6007. Phase 0 cannot merge unless smoke test renders Button (eng-review #7). |
| Test gates | Playwright E2E smoke suite (golden-path flows) + per-component `@testing-library` render tests per tier (eng-review #8). |
| Modal | Codemod all 52 consumer sites in Tier 5. No compat wrapper. Freeze Modal-touching files on `dev` during Tier 5 review (eng-review #2). |
| Forms PR | Tier 3 + Tier 4 merged into one PR: TextField, NumberField, SearchField, Checkbox, RadioGroup, ToggleButton, Select, ComboBox, MultiSelectComboBox + Field + LoadingSpinner + `form/utils.tsx` rewire (eng-review #3). |
| Cleanup split | Tier 11 splits into 11a (RAC passthrough migration in 15 files) and 11b (delete `@op/ui` + uninstall RAC) (eng-review #4). |
| Icon rewrite | `scripts/rewrite-icons.mjs` auto-generates lucide → react-icons/lu map from `lucide-react` exports. Manual override file for non-lucide cases (eng-review #5). |
| ui-next deps | `package.json` declares `@base-ui/react`, `class-variance-authority`, `tailwind-merge`, `tailwind-variants`, `lucide-react`, `sonner` as direct dependencies (eng-review #6). |

## Phase 0 — Foundation (1 PR)

Branch: `shadcn/00-foundation` off `shadcn-full-install`.

Goal: empty `@op/ui-next` package with shadcn `base-nova` wired, smoke-tested by installing Button, Storybook running. Zero app changes.

### Files created

```
packages/ui-next/
  package.json
  tsconfig.json
  turbo.json
  eslint.config.mjs
  postcss.config.mjs
  components.json
  MIGRATION_PLAN.md
  README.md
  src/
    styles.css
    lib/utils.ts
    components/ui/button.tsx  (smoke test from `shadcn add @shadcn-base/button`)
  .storybook/
    main.ts
    preview.tsx
  stories/
    Button.stories.tsx
  scripts/
    rewrite-icons.mjs
```

### Files modified

```
package.json        # add "w:ui-next": "pnpm --filter @op/ui-next"
CLAUDE.md           # add ui-next to workspace shortcuts
pnpm-workspace.yaml # confirm packages/* glob picks it up (likely no edit)
```

### `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@op/ui-next/components",
    "utils": "@op/ui-next/lib/utils",
    "ui": "@op/ui-next/components/ui",
    "lib": "@op/ui-next/lib",
    "hooks": "@op/ui-next/hooks"
  },
  "registries": {
    "@shadcn-base": "https://ui.shadcn.com/r/styles/base-nova/{name}.json"
  }
}
```

### `package.json` exports (Phase 0)

```json
{
  "name": "@op/ui-next",
  "private": true,
  "type": "module",
  "exports": {
    "./styles.css": "./src/styles.css",
    "./lib/utils": "./src/lib/utils.ts"
  }
}
```

Component exports added per-PR in later phases.

### Smoke test

```bash
pnpm w:ui-next add @shadcn-base/button
pnpm w:ui-next exec node scripts/rewrite-icons.mjs
pnpm w:ui-next typecheck
pnpm w:ui-next storybook   # port 6007
```

Expected: `src/components/ui/button.tsx` wraps `@base-ui/react/button`, icons rewritten to `react-icons/lu`, Storybook renders Button story.

### Phase 0 gates

- `pnpm typecheck` green
- `pnpm format:check` green
- `pnpm build` green (Turbo auto-picks up `@op/ui-next`)
- Storybook starts cleanly on port 6007
- App build unchanged (`pnpm w:app build` succeeds)

## Component classification (post base-nova audit)

68 components in `@op/ui`. Reclassified after confirming base-nova registry coverage.

### Category A — Direct shadcn (mostly `shadcn add` + style restyle)

Button, Checkbox, RadioGroup, Switch (ToggleButton), Tooltip, Popover, Dialog, AlertDialog, Tabs, Toast (sonner), Skeleton, Avatar, Link, Sheet, Breadcrumbs, Accordion, Table, AlertBanner, Select, ComboBox, Menu (DropdownMenu), Pagination, Calendar, Field (layout-only), InputGroup, Spinner (LoadingSpinner). **~25 items.**

### Category B — Thin adapter / composition over shadcn

Form (tanstack wrapper stays), IconButton (Button + size icon), DropDownButton (Button + DropdownMenu), OptionMenu (DropdownMenu), CommentButton, ReactionsButton, Surface (Card), Chip (Badge), StatusDot, EmptyState (Empty), FooterBar, ProfileItem, NotificationPanel, MediaDisplay, HorizontalList, AutoSizeInput, Header (typography), TextField (Input + Field id-wiring), NumberField (Input + clamp), SearchField (Input + icon), TagGroup (Badge + remove). **~21 items.**

### Category C — Wrap base-ui Combobox with custom multi-select logic

MultiSelectComboBox (async creation, level/hasChildren tree, tag-rendered selection). **1 item.**

### Category D — Custom port, restyle only

RichTextEditor (TipTap), Sortable (dnd-kit), Sidebar (custom motion + responsive), AvatarUploader, BannerUploader, FileDropZone (RAC DropZone), FacePile, GrowingFacePile, PhaseStepper, Stepper (framer-motion), SplitPane, CollapsibleConfigCard, LogoLoop, ShaderBackground (three.js), SocialLinks, Confetti, ReactionTooltip, DatePicker (Calendar + Popover + custom parse), CheckIcon. **~19 items.**

### Defer / delete (zero app imports)

ShaderBackground, CategoryList, AutoSizeInput (0 imports), Confetti (internal-only). Verify before Tier 5; delete instead of port if still unused.

## Tiered rollout

Each tier is one PR (or 1–2 PRs if cluster > 5 components). Branch per tier: `shadcn/NN-tier-name` off `shadcn-full-install`.

### Tier 0 — Field (1 PR, `shadcn/01-field`)

- `shadcn add @shadcn-base/field @shadcn-base/label @shadcn-base/input @shadcn-base/textarea @shadcn-base/input-group`
- Compose `@op/ui-next/Field` re-exporting:
  - `Label = FieldLabel`
  - `Description = FieldDescription`
  - `FieldError` (auto-hides via `if (!content) return null`)
  - `FieldGroup = InputGroup` (back-compat alias)
  - `Input` with `icon`/`color`/`size`/`hasIcon` variants layered on top
  - `TextArea` with `variant` variants
- Add: shadcn's `Field`, `FieldSet`, `FieldLegend`, `FieldSeparator`, `FieldTitle`, `FieldContent`, `FieldGroup` (new = vertical stacker)
- Stories for each
- No app changes yet — Field consumers migrate in Tier 1

### Tier 1 — Foundation primitives (1 PR, `shadcn/02-foundation`)

Cluster: Button, Spinner (LoadingSpinner), Tooltip, Popover, ListBox (DropdownMenu-style), IconButton.

- `shadcn add @shadcn-base/button @shadcn-base/spinner @shadcn-base/tooltip @shadcn-base/popover @shadcn-base/dropdown-menu`
- Hand-port `IconButton` as thin Button wrapper
- Codemod app imports (92 + 39 + 9 + 6 + 13 + 8 ≈ 167 files)
- Hand-fix prop renames (variant naming, etc.)
- Stories

### Tier 2 — Layout + display primitives (1 PR, `shadcn/03-layout`)

Cluster: Surface (Card), Skeleton, Avatar, Badge/Chip, Separator, Header, Link.

- `shadcn add @shadcn-base/card @shadcn-base/skeleton @shadcn-base/avatar @shadcn-base/badge @shadcn-base/separator`
- Hand-port Header (typography wrapper), Link (Button asChild)
- Codemod app imports (15 + 52 + 29 + 8 + N + 65 + 4)
- Stories

### Tier 3 — Forms PR (1 PR, `shadcn/04-forms`)

Cluster: TextField, NumberField, SearchField, Checkbox, RadioGroup, ToggleButton, Select, ComboBox, MultiSelectComboBox + LoadingSpinner (if not already in Tier 1). Form-bound 5 (TextField, Checkbox, ToggleButton, Select, MultiSelectComboBox) must migrate together because `apps/app/src/components/form/utils.tsx` `createFormHook` registers them as a unit. Splitting tiers leaves utils.tsx mid-flight with mixed imports → form regression risk.

- `shadcn add @shadcn-base/checkbox @shadcn-base/radio-group @shadcn-base/toggle @shadcn-base/select @shadcn-base/combobox`
- Wrap base-nova `input`/`textarea` in `TextField` adapter (`useId()`, multiline branch, char counter)
- Wrap in `NumberField` (clamp on blur)
- Wrap in `SearchField` (`input-group` + icon slot, clear button)
- Build `MultiSelectComboBox` as base-nova Combobox extension (multi-mode + tag chips + async creation + level/hasChildren)
- Update `apps/app/src/components/form/utils.tsx` `createFormHook` registration in same PR (all 5 widgets at once)
- Codemod app imports for all 9 components
- Per-component render tests
- Stories

### Tier 4 — Overlays + nav (renumbered)

(Was Tier 5 in original draft. All later tiers shift down by one.)

### Tier 4 — Overlays + nav (1 PR, `shadcn/05-overlays`)

Cluster: Dialog, Modal (full codemod, NO compat wrapper), Sheet, AlertBanner, Breadcrumbs, Pagination, Tabs.

- `shadcn add @shadcn-base/dialog @shadcn-base/sheet @shadcn-base/alert @shadcn-base/breadcrumb @shadcn-base/pagination @shadcn-base/tabs`
- **Modal: codemod all 52 consumer sites to shadcn `Dialog` API.** Drop RAC `OverlayTriggerStateContext` + render-prop `close` pattern. Consumers use shadcn Dialog's `open`/`onOpenChange` controlled state. NO compat shim — clean break.
- Merges into `shadcn-full-install` only. No `dev` contention during review.
- Codemod app imports (52 Modal + 13 Dialog + 3 Sheet + 7 AlertBanner + 3 Breadcrumbs + 3 Pagination + 14 Tabs)
- Per-component render tests
- Stories

### Tier 5 — Menus + nav (1 PR, `shadcn/06-menus`)

Cluster: Menu, OptionMenu, DropDownButton, CommentButton, ReactionsButton, TagGroup.

- Build on `dropdown-menu` from base-nova
- Codemod
- Stories

### Tier 6 — Custom ports A (1 PR, `shadcn/07-custom-display`)

Cluster: FacePile, GrowingFacePile, ProfileItem, StatusDot, EmptyState, FooterBar, MediaDisplay, NotificationPanel, HorizontalList, TranslateBanner, AutoSizeInput.

- Pure ports, restyle to base-nova
- Codemod, stories

### Tier 7 — Custom ports B (1 PR, `shadcn/08-custom-form`)

Cluster: AvatarUploader, BannerUploader, FileDropZone, DatePicker.

- AvatarUploader / BannerUploader: port file-button + base-nova primitives
- FileDropZone: keep RAC `DropZone` for now (no base-ui equivalent); restyle
- DatePicker: compose base-nova `calendar` + `popover` + custom parse logic
- Codemod, stories

### Tier 8 — Custom ports C (1 PR, `shadcn/09-custom-complex`)

Cluster: RichTextEditor, Sortable, Sidebar, PhaseStepper, Stepper, SplitPane, CollapsibleConfigCard.

- RichTextEditor: keep TipTap, restyle toolbar with base-nova `toggle`/`button`
- Sortable: keep dnd-kit, restyle DragHandle/DropIndicator
- Sidebar: port custom-context + framer-motion, restyle
- PhaseStepper / Stepper / SplitPane / CollapsibleConfigCard: pure ports
- Codemod, stories

### Tier 9 — Re-theme (1 PR, `shadcn/10-retheme`)

- Map base-nova CSS vars → `--op-*` tokens in `packages/ui-next/src/styles.css` `@theme inline` block (replacing the base-nova defaults that have been live since Phase 0).
- Dark mode mapping.
- Visual sweep via `/browse` on key pages.
- Playwright E2E baseline refresh (style change is intentional).

### Tier 10a — RAC passthrough migration (1 PR, `shadcn/11a-rac-direct`)

- Migrate 15 `@op/ui/RAC|RAH|RAS` import sites to direct `react-aria-components` / `react-aria` / `react-stately` imports.
- No deletes yet — `@op/ui` still installed for any custom-port-internal RAC usage.
- Independent verification before deletion PR.

### Tier 10b — Final cleanup (1 PR, `shadcn/11b-cleanup`)

- Verify `grep -rl '@op/ui' apps packages services | grep -v node_modules` returns empty.
- Delete `packages/ui/` directory.
- Remove `@op/ui` from any `package.json` deps.
- Uninstall `react-aria-components`, `react-aria`, `react-stately`, `react-aria-tailwind-starter` if no remaining consumers.
- (Optional follow-up PR) rename `@op/ui-next` → `@op/ui`.

## Total PR count

12 PRs against `shadcn-full-install`:
1. Phase 0 — Foundation
2. Tier 0 — Field
3. Tier 1 — Foundation primitives (Button, Spinner, Tooltip, Popover, ListBox, IconButton)
4. Tier 2 — Layout (Surface, Skeleton, Avatar, Badge, Separator, Header, Link)
5. Tier 3 — Forms (TextField, NumberField, SearchField, Checkbox, RadioGroup, ToggleButton, Select, ComboBox, MultiSelectComboBox + `form/utils.tsx`)
6. Tier 4 — Overlays + nav (Dialog, **Modal (52-site codemod)**, Sheet, AlertBanner, Breadcrumbs, Pagination, Tabs)
7. Tier 5 — Menus (Menu, OptionMenu, DropDownButton, CommentButton, ReactionsButton, TagGroup)
8. Tier 6 — Custom display ports
9. Tier 7 — Custom form ports
10. Tier 8 — Custom complex ports
11. Tier 9 — Re-theme (`--op-*` mapping)
12. Tier 10a — RAC passthrough → direct imports
13. Tier 10b — Delete `@op/ui` + uninstall RAC

Then one final merge `shadcn-full-install` → `dev`.

## Post-migration TODOs

1. **Visual regression automation review.** Skipped during migration (target style intentionally different). Post-Tier 10b, design is stable — evaluate Playwright screenshot diffs or Chromatic for ongoing protection.
2. **Prod bundle audit.** Skipped during migration. Measure `pnpm w:app build` First Load JS per route after Tier 10b vs current baseline. Investigate any regression > 10%.

## Risk register

| # | Risk | Mitigation |
|---|---|---|
| 1 | shadcn CLI may not target workspace packages cleanly | Verify in Phase 0 smoke test; fail-fast |
| 2 | Tailwind v4 token bleed between ui-next styles.css and app `@op/styles` | App imports ui-next styles.css from Phase 0. Base-nova CSS vars (`--background`, `--primary`, etc.) coexist with `--op-*` tokens (no name collision). Re-theme in Tier 9 swaps base-nova defaults for `--op-*` mapping. |
| 3 | base-nova components depend on lucide-react; rewrite-icons.mjs missing mappings | Hard-fail on unknown lucide name; manual map maintenance |
| 4 | Storybook 9 + Tailwind v4 + base-ui combo untested | Validate in Phase 0 before committing rest of plan |
| 5 | Final `shadcn-full-install` → `dev` merge accumulates conflicts across all 12 PRs | Tier PRs merge into the integration branch only — no contention during migration. Risk concentrates at final merge. Mitigation: rebase `shadcn-full-install` onto `dev` (or merge `dev` in) at minimum after every 3 tiers. Catches conflicts incrementally instead of one big-bang at the end. |
| 6 | RAC slot wiring loss breaks consumer code | Wrappers (TextField etc.) call `useId()` internally; caller API preserved |
| 7 | Big-bang merge of `shadcn-full-install` to `dev` is huge diff | Sub-PRs merge incrementally to the integration branch; reviewers see ~5 components at a time |
| 8 | Long-lived dual `@op/ui` + `@op/ui-next` bundles inflate dev builds | Acceptable for dev; prod ships only after Tier 11 |
| 9 | `apps/app/src/components/form/utils.tsx` field component registrations break mid-migration | Form-bound 5 (TextField/Select/MultiSelectComboBox/ToggleButton/Checkbox) migrate together with `form/utils.tsx` update in same PR |
| 10 | Functional regressions ship without tests | Phase 0 adds Playwright E2E smoke suite (5–8 golden-path flows: login, view decision, edit profile, create proposal, modal open, multi-select). Each tier PR adds `@testing-library` render tests per migrated component. CI runs both gates. Visual diffs skipped — target style intentionally different from current. |
| 11 | shadcn add inside workspace package may not resolve aliases / install deps cleanly | Phase 0 smoke test gates the entire PR: `pnpm w:ui-next add @shadcn-base/button` must succeed and write to `packages/ui-next/src/components/ui/button.tsx`. ui-next `package.json` declares all transitive shadcn deps (`@base-ui/react`, `class-variance-authority`, `tailwind-merge`, `tailwind-variants`, `lucide-react`, `sonner`) directly to avoid hoist ambiguity. |
| 12 | Storybook v10 + Tailwind v4 + base-ui untested locally | Phase 0 cannot merge unless `pnpm w:ui-next storybook` renders Button story. Fallback: if Storybook fails, defer scaffold to follow-up PR and ship rest of Phase 0. |
| 13 | `rewrite-icons.mjs` mapping drift as base-nova components evolve | Script auto-generates lucide → react-icons/lu map from `lucide-react` package exports at runtime. Manual override file only for non-lucide cases (e.g., `FcGoogle`, `react-icons/si`). Hard-fail on unknown name with diff guidance. |

## Out of scope

- Migrating any `apps/api` code (no `@op/ui` imports there)
- Rewriting `@tanstack/react-form` wrapper architecture
- Replacing `react-icons` library
- Introducing new components beyond what `@op/ui` already exposes
- App-level refactors triggered by ui-next API differences (deferred per-PR)
