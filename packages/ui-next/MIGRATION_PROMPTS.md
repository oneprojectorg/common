# `@op/ui` → `@op/ui-next` migration prompts

Phase-2 migration scripts. Each prompt is self-contained — hand it to a fresh agent to swap a tier of `@op/ui` consumers to `@op/ui-next`.

**Prerequisite:** phase 1 (`@op/ui-next` package ship) has merged. The package exists side-by-side with `@op/ui`; both work.

---

## Shared rules — applies to every tier

Read this first before any tier prompt.

### Workflow

1. Read CLAUDE.md in repo root and at `packages/ui-next/`.
2. `grep -rn "from '@op/ui/<Component>'" apps packages services` (exclude `node_modules`, `.next/`, `packages/ui/`) to find every caller.
3. Swap imports + apply API mapping per tier table below.
4. Run `pnpm w:ui-next typecheck` then `pnpm w:app typecheck` (and any other touched workspace).
5. Run `pnpm format:changes`.
6. Commit. **Don't push, don't open a PR — those are manual.**

### Discipline

- **Stay in repo root.** Don't `cd` into subdirs. Use absolute paths or `pnpm w:<workspace> <cmd>` shortcuts (`pnpm w:app`, `pnpm w:ui-next`, etc).
- **Don't run `pnpm install` autonomously.** If a rebase or new dep is needed, ask the user.
- **Don't commit `.mcp.json`, `CLAUDE.md`, `pnpm-lock.yaml`, or `.claude/skills/`** unless they're part of the actual tier scope. They're frequently dirty from parallel work.
- **Don't search outside `.trees/<branch>/`** — never traverse to parent dirs.
- **Format only after typecheck passes.** Don't format before fixing TS errors — formatter can hide them.
- **Avoid `any` and `as` assertions.** If a type is wrong, fix the source, don't paper over.
- **Don't add error handling for impossible scenarios.** Trust framework guarantees. Validate only at boundaries.
- **No comments explaining WHAT.** Only WHY when non-obvious. Don't reference the migration in comments.

### Per-component name-drift map

When investigating compat wrappers vs vanilla shadcn primitives, this is the canonical pair list. Don't match by name alone — these pairs are non-obvious:

```
@op/ui-next/AlertBanner    ↔ ui/alert.tsx
@op/ui-next/Avatar         ↔ ui/avatar.tsx
@op/ui-next/Breadcrumbs    ↔ ui/breadcrumb.tsx
@op/ui-next/Button         ↔ ui/button.tsx
@op/ui-next/Card           ↔ ui/card.tsx       (was: @op/ui/Surface)
@op/ui-next/Checkbox       ↔ ui/checkbox.tsx
@op/ui-next/Chip           ↔ ui/badge.tsx
@op/ui-next/ComboBox       ↔ ui/combobox.tsx
@op/ui-next/DataTable      ↔ ui/table.tsx      (+ @tanstack/react-table)
@op/ui-next/DatePicker     ↔ ui/calendar.tsx + ui/popover.tsx
@op/ui-next/EmptyState     ↔ ui/empty.tsx
@op/ui-next/Field          ↔ ui/field.tsx
@op/ui-next/IconButton     ↔ ui/button.tsx     (size=icon variants)
@op/ui-next/Input          ↔ ui/input.tsx + ui/input-group.tsx
@op/ui-next/LoadingSpinner ↔ ui/spinner.tsx
@op/ui-next/Menu           ↔ ui/dropdown-menu.tsx
@op/ui-next/Modal          ↔ ui/dialog.tsx
@op/ui-next/OptionMenu     ↔ ui/dropdown-menu.tsx (+ IconButton trigger)
@op/ui-next/Pagination     ↔ ui/pagination.tsx
@op/ui-next/ProfileItem    ↔ ui/item.tsx
@op/ui-next/RadioGroup     ↔ ui/radio-group.tsx
@op/ui-next/SearchField    ↔ ui/input.tsx + ui/input-group.tsx
@op/ui-next/Select         ↔ ui/select.tsx
@op/ui-next/Separator      ↔ ui/separator.tsx
@op/ui-next/Sheet          ↔ ui/sheet.tsx
@op/ui-next/Skeleton       ↔ ui/skeleton.tsx
@op/ui-next/Tabs           ↔ ui/tabs.tsx
@op/ui-next/TagGroup       ↔ ui/badge.tsx
@op/ui-next/Textarea       ↔ ui/textarea.tsx
@op/ui-next/TextField      ↔ ui/input.tsx + ui/field.tsx
@op/ui-next/Toast          ↔ ui/sonner.tsx
@op/ui-next/ToggleButton   ↔ ui/switch.tsx
@op/ui-next/Tooltip        ↔ ui/tooltip.tsx
```

### Pitfalls encountered during phase 0 (the consolidation branch)

- **`variant="icon"` on Button forces `size="icon"` which is a fixed square.** If your migrated caller has text inside the button (icon + label), drop `variant="icon"` — leave just `size="small"` etc.
- **`isDismissable` on Modal/Sheet is reason-filtered.** Don't pass it as a literal — the compat wrapper translates it to `showCloseButton` + filters `onOpenChange` events to ignore `outside-press` / `escape-key` when `false`.
- **Stale `pg_class.reltuples` from `t.platform.getStats`** is unreliable for overflow gates. Use `array.length` of the actual fetched list, not the stat.
- **`overflowClassName` and `wrapperClassName` on Modal don't exist anymore.** Callers using them for slide-up sheet effects should migrate to `<Sheet side="bottom">` instead.
- **Avoid `display: contents` wrappers** around children of `AvatarGroup` / any element using `-space-x-*`. Contents-display elements ignore margins, so negative-margin overlap silently fails.
- **`@internationalized/date` is gone.** DatePicker uses native `Date`. Replace any `parseAbsoluteToLocal` / `toCalendarDate` / `.compare()` with `new Date(str)` + `.getTime()`.
- **Confetti must mount in a portal-safe context.** Modal already wraps it in `DialogPortal`; if you call `<Confetti />` standalone elsewhere, ensure no transformed ancestor (CSS spec: `position: fixed` resolves to nearest transformed ancestor).
- **Don't try to use `selectedKey` on the new Select — use `value`.** The compat wrapper accepts both for source compat, but new code should pass `value`.

---

## Tier 1 — Foundation (Button, IconButton, LoadingSpinner, Tooltip)

### Goal
Replace 50+ call sites importing from `@op/ui/Button`, `@op/ui/IconButton`, `@op/ui/LoadingSpinner`, `@op/ui/Tooltip` with `@op/ui-next` equivalents.

### Import swaps

```
from '@op/ui/Button'         → from '@op/ui-next/Button'
from '@op/ui/IconButton'     → from '@op/ui-next/IconButton'
from '@op/ui/LoadingSpinner' → from '@op/ui-next/LoadingSpinner'
from '@op/ui/Tooltip'        → from '@op/ui-next/Tooltip'
```

### API translation

| Old (`@op/ui`) | New (`@op/ui-next`) | Notes |
|---|---|---|
| `<Button color="primary">` | `<Button color="primary">` | wrapper translates color→variant |
| `<Button color="secondary">` | `<Button color="secondary">` | maps to `variant="outline"` |
| `<Button color="destructive">` | `<Button color="destructive">` | |
| `<Button color="ghost">` | `<Button color="ghost">` | |
| `<Button color="gradient">` | `<Button color="gradient">` | wrapper adds gradient classes |
| `<Button variant="primary">` | `<Button>` (default) | drop variant |
| `<Button variant="link">` | `<Button variant="link">` | |
| `<Button variant="pill">` | `<Button variant="pill">` | teal-tinted pill (matches Select pill) |
| `<Button variant="icon" size="small">` icon-only | `<IconButton size="small">` | clearer intent |
| `<Button variant="icon">` with text content | `<Button size="small">` | **drop `variant="icon"`** — it forces square size, overflows on text |
| `<Button isDisabled>` | `<Button isDisabled>` | accepts both `isDisabled` and `disabled` |
| `<Button onPress={...}>` | `<Button onPress={...}>` | accepts both `onPress` and `onClick` |
| `<Button isLoading>` | `<Button isLoading>` | renders Spinner overlay |
| `<TooltipTrigger><Trigger/><Tooltip>...</Tooltip></TooltipTrigger>` | same | wrapper splits children, rehosts on base-ui Tooltip |
| `<TooltipTrigger delay={500}>` | same | |

### Dropped props (zero callers verified)

`scaleOnPress`, `insetShadow`, `backglow` — remove from any caller you find.

### Verification

```bash
pnpm w:ui-next typecheck && pnpm w:app typecheck && pnpm format:changes
```

Visual smoke check: open dev server, exercise a primary button, secondary button, destructive button, icon button with text label, tooltip on hover.

### Commit message

```
refactor(app): migrate Tier 1 to @op/ui-next (Button/IconButton/Spinner/Tooltip)

- Swap imports across N call sites
- Drop variant="icon" on text-bearing buttons (forced square size overflowed)
```

---

## Tier 2 — Layout & display atoms

### Goal
Migrate layout/display primitives: `Header`, `Link`, `Surface`, `Skeleton`, `Avatar`, `Chip`, `Separator`, `StatusDot`, `EmptyState`, `FooterBar`, `CheckIcon`.

### Import swaps

```
from '@op/ui/Header'       → from '@op/ui-next/Header'
from '@op/ui/Link'         → from '@op/ui-next/Link'
from '@op/ui/Surface'      → from '@op/ui-next/Card'      (** renamed **)
from '@op/ui/Skeleton'     → from '@op/ui-next/Skeleton'
from '@op/ui/Avatar'       → from '@op/ui-next/Avatar'
from '@op/ui/Chip'         → from '@op/ui-next/Chip'
from '@op/ui/Separator'    → from '@op/ui-next/Separator'
from '@op/ui/StatusDot'    → from '@op/ui-next/StatusDot'
from '@op/ui/EmptyState'   → from '@op/ui-next/EmptyState'
from '@op/ui/FooterBar'    → from '@op/ui-next/FooterBar'
from '@op/ui/CheckIcon'    → from '@op/ui-next/CheckIcon'
```

### Codemod for Surface → Card

`Surface` is gone. The symbol becomes `Card` everywhere:

```
import { Surface } from '@op/ui-next/Card';  // ← won't work, no Surface export
import { Card } from '@op/ui-next/Card';      // ← correct
```

Rename `<Surface>` → `<Card>` and `</Surface>` → `</Card>` across the codemod. Watch for naming collisions with caller-defined local `Surface` components (rare but possible). The package also exports the slot family (`CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription`, `CardAction`) — most callers won't use them, but they're available if a structural refactor is in scope.

### API translation

| Old | New | Notes |
|---|---|---|
| `<Avatar placeholder="N">` | same | auto-generates initial + gradient fallback |
| `<Avatar size="md">` | same | accepts `sm` / `md` / `lg` |
| `<EmptyState icon={<Icon/>}>...` | same | identical API |
| `<FooterBar.Start>` etc | same | sub-components keep their name |

### Pitfalls

- **`Surface` had no padding by default; `Card` likewise has no `py-*`.** Padding lives in `CardContent` / `CardHeader` / `CardFooter`. Most callers add their own `p-*` className — keep it.
- **Don't migrate `Surface` callers into structured `Card` slot composition unless the user explicitly asks.** The rename should be mechanical; slot restructuring is per-feature work.

### Commit message

```
refactor(app): migrate Tier 2 to @op/ui-next (layout/display atoms)

- Header/Link/Skeleton/Avatar/Chip/Separator/StatusDot/EmptyState/FooterBar/CheckIcon swapped
- Surface → Card (renamed during shadcn migration)
```

---

## Tier 3 — Form atoms (TextField, NumberField, SearchField, Select, Checkbox, RadioGroup)

### Goal
Migrate form atoms. These are the highest-volume tier — likely 80+ call sites combined.

### Import swaps

```
from '@op/ui/TextField'   → from '@op/ui-next/TextField'
from '@op/ui/NumberField' → from '@op/ui-next/NumberField'
from '@op/ui/SearchField' → from '@op/ui-next/SearchField'
from '@op/ui/Select'      → from '@op/ui-next/Select'
from '@op/ui/Checkbox'    → from '@op/ui-next/Checkbox'
from '@op/ui/RadioGroup'  → from '@op/ui-next/RadioGroup'
```

### API translation

| Old (RAC-based) | New (shadcn-based) | Notes |
|---|---|---|
| `<TextField label="..." value={v} onChange={setV}>` | same | accepts `onChange(value: string)` |
| `<TextField inputProps={{...}}>` | same | preserved |
| `<TextField useTextArea>` | same | renders Textarea instead of Input |
| `<NumberField value={n} onChange={setN}>` | same | numeric validation built-in |
| `<NumberField minValue maxValue>` | same | |
| `<NumberField prefixText="$">` | same | |
| `<SearchField value={q} onChange={setQ}>` | same | |
| `<Select selectedKey={k} onSelectionChange={setK}>` | same OR `<Select value={k} onValueChange={setK}>` | both accepted; prefer `value`/`onValueChange` in new code |
| `<Select items={arr} children={(item) => ...}>` | same | items + render-fn pattern preserved |
| `<SelectItem id="x">Label</SelectItem>` | same | accepts both `id` and `value` |
| `<Checkbox isSelected={b} onChange={setB}>` | `<Checkbox checked={b} onCheckedChange={setB}>` | RAC → base-ui rename |
| `<RadioGroup value={v} onChange={setV}>` | `<RadioGroup value={v} onValueChange={setV}>` | |
| `<Radio value="x">` | `<RadioGroupItem value="x">` | renamed |

### Pitfalls

- **Checkbox `isSelected` doesn't exist in new wrapper.** Mechanical rename: `isSelected={b}` → `checked={b}`, `onChange={setB}` → `onCheckedChange={setB}`.
- **Radio → RadioGroupItem rename is required.** Watch for callers that destructure `Radio` from the import.
- **Select `popoverProps={{ className: '...' }}`** is supported on both old and new. Used by ~2 callers; keep it.
- **`<Select>` with no `label` / `description` / `errorMessage`** renders bare trigger (no Field wrapper). Don't add a default `min-w-*` className — that broke ResponsiveSelect; let triggers size to content.

### Commit message

```
refactor(app): migrate Tier 3 to @op/ui-next (form atoms)

- TextField/NumberField/SearchField/Select/Checkbox/RadioGroup swapped
- Checkbox: isSelected→checked, onChange→onCheckedChange (RAC→base-ui)
- Radio→RadioGroupItem
```

---

## Tier 4 — Overlays (Modal, Tabs, Sheet)

### Goal
Migrate overlay primitives.

### Import swaps

```
from '@op/ui/Modal' → from '@op/ui-next/Modal'
from '@op/ui/Tabs'  → from '@op/ui-next/Tabs'
from '@op/ui/Sheet' → from '@op/ui-next/Sheet'
```

### API translation

| Old | New | Notes |
|---|---|---|
| `<Modal isOpen={o} onOpenChange={setO}>` | same | reason-filter applied internally |
| `<Modal isDismissable={false}>` | same | translates to `showCloseButton={false}` + reason filter |
| `<Modal isKeyboardDismissDisabled>` | same | filters escape-key from onOpenChange |
| `<Modal confetti>` | same | renders `<Confetti />` portaled into DialogPortal |
| `<ModalHeader>...` | same | becomes DialogHeader + DialogTitle |
| `<ModalBody>...` | same | `<div data-slot="modal-body">` |
| `<ModalFooter>...` | same | DialogFooter |
| `<Tabs selectedKey={k} onSelectionChange={setK}>` | same | translates to value/onValueChange |
| `<Tab variant="pill">` | same | **per-tab variant IS real and used; don't drop it** |
| `<TabList>` | same | |
| `<TabPanel>` | same | becomes shadcn TabsContent |
| `<Sheet side="bottom" isOpen onOpenChange isDismissable>` | same | |
| `<SheetHeader titleId="x">` | same | `titleId` forwarded for aria-labelledby |
| `<SheetBody>` | same | spreads HTMLAttributes (role, etc) |

### Dropped Modal props (silently — but check callers!)

`Modal` no longer accepts:

- `surface="flat"` — drop from callers; vanilla shadcn dialog has no flat variant
- `wrapperClassName` — never had a use case
- `overlayClassName` — **callers using this for slide-up sheet effects should migrate to `<Sheet side="bottom">` instead.** Specifically: any `Modal` with `overlayClassName="...slide-in-from-bottom..."` or `className="...slide-in-from-bottom..."` is using Modal as a bottom-anchored sheet — that's wrong. Migrate the caller to Sheet primitive.

`Sheet` no longer accepts:

- `overlayClassName` — drop
- `SheetHeader.onClose` — drop, vanilla SheetContent renders its own close

### Pitfalls

- **A Modal that renders an avatar drawer / action menu / bottom-anchored picker is misusing Modal.** Migrate to Sheet `side="bottom"` (see SiteHeader, ProposalCardMenu for examples).
- **`Tab variant="pill"`** appears in AllDecisions and LandingScreen and others — keep.
- **Modal renders dismissable close X by default.** To hide it, pass `isDismissable={false}`.

### Commit message

```
refactor(app): migrate Tier 4 to @op/ui-next (Modal/Tabs/Sheet)

- Modal/Tabs/Sheet imports swapped
- Drop Modal surface=flat / wrapperClassName / overlayClassName (no vanilla equivalents)
- Bottom-anchored Modals (SiteHeader, ProposalCardMenu) migrated to Sheet side=bottom
```

---

## Tier 5 — Menus (Menu, OptionMenu)

### Goal
Migrate dropdown menus.

### Import swaps

```
from '@op/ui/Menu'       → from '@op/ui-next/Menu'
from '@op/ui/OptionMenu' → from '@op/ui-next/OptionMenu'
from '@op/ui/ListBox'    →                                  (case-by-case, see below)
```

### API translation

| Old | New | Notes |
|---|---|---|
| `<MenuTrigger><Trigger/><Menu>...</Menu></MenuTrigger>` | `<DropdownMenu><DropdownMenuTrigger render={<Trigger/>}/><DropdownMenuContent>...</DropdownMenuContent></DropdownMenu>` | restructure |
| `<MenuItem onAction={fn}>Label</MenuItem>` | `<DropdownMenuItem onClick={fn}>Label</DropdownMenuItem>` | renamed |
| `<DropdownItem>` | `<DropdownMenuItem>` | same |
| `<OptionMenu aria-label="...">` | same | wraps DropdownMenu + IconButton trigger |
| `<OptionMenu variant="outline" size="medium">` | same | |

### ListBox special case (used for search-result dropdowns)

Old:
```tsx
import { ListBox, ListBoxItem } from '@op/ui/RAC';
<ListBox onAction={(key) => ...}>
  <ListBoxItem id="x">...</ListBoxItem>
</ListBox>
```

There's no direct `ListBox` in `@op/ui-next`. Three replacement strategies depending on use case:

1. **Search-results dropdown (custom portal):** Replace ListBox with a `<div role="listbox">` + button items with `role="option"`. See `ShareProposalModal.tsx` for the pattern.
2. **Multi-select chip-input pattern:** Use `@op/ui-next/MultiSelectComboBox` instead.
3. **In-modal select list with selection state:** Use `@op/ui-next/Combobox` or `@op/ui-next/Select` depending on whether typing is needed.

### Commit message

```
refactor(app): migrate Tier 5 to @op/ui-next (menus)

- Menu/OptionMenu/ListBox swapped
- MenuTrigger→DropdownMenu, MenuItem→DropdownMenuItem
- ListBox use cases replaced per-site (role=listbox/option buttons, MultiSelectComboBox, or Combobox)
```

---

## Tier 6 — Display composites (ProfileItem, FacePile, MediaDisplay, +ports)

### Goal
Migrate display composites and several smaller pure ports: `AutoSizeInput`, `LogoLoop`, `PhaseStepper`, `HorizontalList`, `NotificationPanel`, `Stepper`, `SocialLinks`, `TranslateBanner`, `ReactionsButton`, `CommentButton`, `ReactionTooltip`.

### Import swaps

```
from '@op/ui/ProfileItem'        → from '@op/ui-next/ProfileItem'
from '@op/ui/FacePile'           → from '@op/ui-next/FacePile'
from '@op/ui/GrowingFacePile'    → from '@op/ui-next/FacePile'  (** merged **)
from '@op/ui/MediaDisplay'       → from '@op/ui-next/MediaDisplay'
from '@op/ui/AutoSizeInput'      → from '@op/ui-next/AutoSizeInput'
from '@op/ui/LogoLoop'           → from '@op/ui-next/LogoLoop'
from '@op/ui/PhaseStepper'       → from '@op/ui-next/PhaseStepper'
from '@op/ui/HorizontalList'     → from '@op/ui-next/HorizontalList'
from '@op/ui/NotificationPanel'  → from '@op/ui-next/NotificationPanel'
from '@op/ui/Stepper'            → from '@op/ui-next/Stepper'
from '@op/ui/SocialLinks'        → from '@op/ui-next/SocialLinks'
from '@op/ui/TranslateBanner'    → from '@op/ui-next/TranslateBanner'
from '@op/ui/ReactionsButton'    → from '@op/ui-next/ReactionsButton'
from '@op/ui/CommentButton'      → from '@op/ui-next/CommentButton'
from '@op/ui/ReactionTooltip'    → from '@op/ui-next/ReactionTooltip'
```

### FacePile merger

`GrowingFacePile` no longer exists — its behavior is folded into `FacePile` via an optional `maxItems` prop:

- `<FacePile items={...}>` → static render, no overflow
- `<FacePile items={...} maxItems={20}>` → ResizeObserver-driven auto-shrink + `+N` overflow chip

Migrate `<GrowingFacePile maxItems={N}>` → `<FacePile maxItems={N}>`.

### Pitfall: FacePile items must produce DOM elements

`FacePile` uses vanilla shadcn `AvatarGroup` which applies `-space-x-2` via `margin-left`. Margin can't apply to `display: contents` elements. Don't wrap items in `<span className="contents">` — render the original avatar/link nodes directly.

### Commit message

```
refactor(app): migrate Tier 6 to @op/ui-next (display composites)

- ProfileItem/FacePile/MediaDisplay + 9 smaller ports swapped
- GrowingFacePile → FacePile with maxItems prop (merged)
```

---

## Tier 7 — Form composites (Form, BannerUploader, AvatarUploader, FileDropZone, ComboBox, MultiSelectComboBox)

### Goal
Migrate form composites and uploaders.

### Import swaps

```
from '@op/ui/Form'                  → from '@op/ui-next/Form'
from '@op/ui/BannerUploader'        → from '@op/ui-next/BannerUploader'
from '@op/ui/AvatarUploader'        → from '@op/ui-next/AvatarUploader'
from '@op/ui/FileDropZone'          → from '@op/ui-next/FileDropZone'
from '@op/ui/ComboBox'              → from '@op/ui-next/ComboBox'
from '@op/ui/MultiSelectComboBox'   → from '@op/ui-next/MultiSelectComboBox'
from '@op/ui/Field'                 → @op/ui-next/Textarea (TextArea) OR @op/ui-next/Field (Field/Label/Description/Error)
```

### TextArea special case

Old `import { TextArea } from '@op/ui/Field'` — this is a native textarea wrapper with `variant="borderless"`. Migrate to `import { Textarea } from '@op/ui-next/Textarea'` (capital T-extarea — vanilla shadcn case).

### ComboBox / MultiSelectComboBox API

| Old | New | Notes |
|---|---|---|
| `<ComboBox items={arr} children={(item) => ...}>` | same | render-fn supported |
| `<ComboBox selectedKey defaultSelectedKey>` | same | aliases for `value` / `defaultValue` |
| `<MultiSelectComboBox value={Option[]} onChange={(opts) => ...}>` | same | chip-input pattern |
| `<MultiSelectComboBox allowAdditions>` | same | Enter creates new |
| `<MultiSelectComboBox enableLocalSearch={false}>` | same | for server-filtered modes |

### Pitfall: CollaborativeMultiSelectField

If you encounter `CollaborativeMultiSelectField` (yjs-synced multi-select) — it was rewritten on top of `MultiSelectComboBox`. Its API is `options/initialValue/onChange/fragmentName/placeholder`. Don't migrate its internals; just check it still works after the underlying primitive changes.

### Commit message

```
refactor(app): migrate Tier 7 to @op/ui-next (form composites)

- Form/BannerUploader/AvatarUploader/FileDropZone/ComboBox/MultiSelectComboBox swapped
- TextArea (from @op/ui/Field) → Textarea (from @op/ui-next/Textarea)
```

---

## Tier 8 — SplitPane

### Goal
Migrate `SplitPane` (4 known consumers).

### Import swap

```
from '@op/ui/SplitPane' → from '@op/ui-next/SplitPane'
```

### API translation

| Old | New | Notes |
|---|---|---|
| `<SplitPane.Pane id="x" label="...">` | same | identical |
| `<SplitPane defaultMobileTabId="x">` | same | |
| `onSelectionChange?: (key: Key) => void` | `onSelectionChange?: (key: string \| number) => void` | dropped RAC `Key` import |

### Commit message

```
refactor(app): migrate Tier 8 to @op/ui-next (SplitPane)
```

---

## Tier 9 — Sidebar

### Goal
Migrate `Sidebar` (9 known consumers).

### Import swap

```
from '@op/ui/Sidebar' → from '@op/ui-next/Sidebar'
```

### Pitfall

`Sidebar` mobile mode uses `useMediaQuery`. The ui-next version inlines the hook (doesn't depend on `@op/hooks`). Don't change anything about how mobile breakpoints work in callers.

### Commit message

```
refactor(app): migrate Tier 9 to @op/ui-next (Sidebar)
```

---

## Tier 10 — Editor composites (RichTextEditor, Sortable, CollapsibleConfigCard)

### Goal
Migrate the three editor composites (17 known sites).

### Import swaps

```
from '@op/ui/RichTextEditor'        → from '@op/ui-next/RichTextEditor'
from '@op/ui/Sortable'              → from '@op/ui-next/Sortable'
from '@op/ui/CollapsibleConfigCard' → from '@op/ui-next/CollapsibleConfigCard'
```

### API translation

| Old | New | Notes |
|---|---|---|
| `<RichTextEditor content onChange>` | same | TipTap-based, identical |
| `<RichTextEditorWithToolbar toolbarPosition="bottom">` | same | |
| `<Sortable items onReorder>` | same | dnd-kit-based |
| `<DragHandle>` | same | |
| `<CollapsibleConfigCard variant="unstyled" isExpanded onExpandedChange>` | same OR `<CollapsibleConfigCard isCollapsible isExpanded onExpandedChange>` | the new version uses `Collapsible` primitive, not Accordion; `variant="unstyled"` is gone, controlled via `isCollapsible` |

### Pitfall

`CollapsibleConfigCard` old API had `variant="unstyled"` — drop it. The new version always renders as a plain card; collapsing is opt-in via `isCollapsible`.

### Commit message

```
refactor(app): migrate Tier 10 to @op/ui-next (RichTextEditor/Sortable/CollapsibleConfigCard)

- 17 sites swapped
- CollapsibleConfigCard drops variant="unstyled" (Collapsible primitive replaces Accordion)
```

---

## Tier 11 — Tables (DataTable replaces RAC Table)

### Goal
Migrate 10 known table consumers from RAC `<Table>` to `@op/ui-next/DataTable` (TanStack-Table-backed).

### Imports to remove

```
from '@op/ui/ui/table' import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, EditableCell }
```

### Imports to add

```
from '@op/ui-next/DataTable' import { DataTable, type ColumnDef, type SortingState }
from '@op/ui-next/Table'     import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }  // for custom skeletons only
```

### API restructure

Old RAC table:
```tsx
<Table>
  <TableHeader>
    <TableColumn isRowHeader>Name</TableColumn>
    <TableColumn>Email</TableColumn>
  </TableHeader>
  <TableBody>
    {rows.map(r => (
      <TableRow key={r.id} id={r.id}>
        <RowCells row={r} />
      </TableRow>
    ))}
  </TableBody>
</Table>
```

New DataTable:
```tsx
const columns: ColumnDef<Row, unknown>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => row.original.name },
  { id: 'email', header: 'Email', cell: ({ row }) => row.original.email },
];

<DataTable columns={columns} data={rows} getRowId={(r) => r.id} />
```

### Critical patterns

1. **`<RowCells>` components that render multiple `<TableCell>`** don't exist in TanStack — each column has its own `cell:` renderer. Inline the JSX into ColumnDef cell renderers. Delete the Row component file when done.

2. **Per-row local state** (e.g. UsersTable's "selected org" dropdown which affected sibling Role column) must be **lifted to a parent map** keyed by row id. Cell renderers read/write via the lifted map. Example:
   ```tsx
   const [selectedByRow, setSelectedByRow] = useState<Record<string, string>>({});
   const setSelectedForRow = (rowId: string, value: string) =>
     setSelectedByRow(prev => ({...prev, [rowId]: value}));
   ```
   Then in the column cell renderer: `<RoleCell selected={selectedByRow[row.id]} onChange={(v) => setSelectedForRow(row.id, v)} />`.

3. **Sort state translation** for RAC `SortDescriptor`-driven tables:
   ```tsx
   // Build SortingState from incoming SortDescriptor:
   const sorting: SortingState = [{ id: descriptor.column, desc: descriptor.direction === 'descending' }];

   // Convert back when DataTable changes sort:
   const handleSortingChange = (next: SortingState) => {
     const [first] = next;
     if (!first) {
       onSortChange({ column: 'name', direction: 'ascending' });
       return;
     }
     onSortChange({ column: first.id, direction: first.desc ? 'descending' : 'ascending' });
   };

   // Mark sortable columns via enableSorting: true on the ColumnDef.
   ```

4. **`EditableCell` is gone.** Replace with inline conditional inside a `TableCell`:
   ```tsx
   <TableCell>
     {isEditing ? <EditForm /> : displayValue}
   </TableCell>
   ```

5. **Custom Skeleton tables** keep using `@op/ui-next/Table` primitives directly (Table/TableHeader/TableRow/TableHead/TableBody/TableCell). DataTable is overkill for skeletons.

6. **`header` field on ColumnDef accepting JSX:** must wrap in function `() => <span/>`, not pass JSX directly — type only allows string OR function.

### Header rendering for actions column

Right-aligned headers via cell function:
```tsx
{ id: 'actions', header: () => <span className="block text-right">Actions</span>, cell: ({row}) => ... }
```

### Commit message

```
refactor(app): migrate Tier 11 (RAC tables → @op/ui-next/DataTable)

- 10 consumers swapped (PlatformAdmin Decisions/Orgs/Users, ProfileUsersAccess, etc)
- Delete *Row.tsx files; inline cell logic into ColumnDef[]
- Per-row shared state lifted to parent map (UsersTable role/org pair)
- SortDescriptor ↔ SortingState adapter for sortable tables
- EditableCell replaced with inline {isEditing ? <Form/> : value} in TableCell
- RolesSection kept on @op/ui-next/Table primitives (per-row edit state + multi-cell rows don't fit TanStack)
```

---

## Tier 12 — DatePicker + tiny ports

### Goal
Migrate `DatePicker` (1 consumer: `PhaseDetailPage`) and a handful of one-off `@op/ui` primitive imports (`Textarea`, `Popover`, `Dialog`, `ListBox`, `RAC`, `Field`).

### Import swaps

```
from '@op/ui/DatePicker' → from '@op/ui-next/DatePicker'
from '@op/ui/Field'      → from '@op/ui-next/Textarea'  (only when TextArea imported)
from '@op/ui/Popover'    → REPLACE with vanilla shadcn pattern (see below)
from '@op/ui/Dialog'     → REPLACE with vanilla shadcn pattern (see below)
from '@op/ui/ListBox'    → see Tier 5 ListBox special case
from '@op/ui/RAC'        → see Tier 5 ListBox special case
```

### DatePicker API change

`@internationalized/date` is gone. The new DatePicker uses native `Date`:

```tsx
// Old
import { parseAbsoluteToLocal, toCalendarDate } from '@internationalized/date';
const date = toCalendarDate(parseAbsoluteToLocal(dateStr));
<DatePicker value={date} onChange={(d) => save(formatCalendarDate(d))} />

// New
const date = new Date(dateStr);
<DatePicker value={date} onChange={(d) => save(d.toISOString())} />
```

Comparisons use native Date arithmetic: `start.getTime() < end.getTime()`, not `.compare()`.

### CollaborativeMultiSelectField special case

Migrate it to `<MultiSelectComboBox>` from `@op/ui-next/MultiSelectComboBox`. Drop the bespoke `DialogTrigger` + `Popover` + `ListBox` composition.

### Commit message

```
refactor(app): migrate Tier 12 to @op/ui-next (DatePicker + tiny ports)

- DatePicker: drops @internationalized/date, native Date throughout
- Textarea: TextArea (from @op/ui/Field) → Textarea (from @op/ui-next/Textarea)
- CollaborativeMultiSelectField: rebuild on MultiSelectComboBox
- ShareProposalModal: ListBox → role=listbox/option button list
```

---

## Tier 13 — Polish & last stragglers (TagGroup, Toast, AlertBanner, Pagination, Breadcrumbs, ToggleButton)

### Goal
Wrap up remaining smaller compat wrappers.

### Import swaps

```
from '@op/ui/TagGroup'     → from '@op/ui-next/TagGroup'
from '@op/ui/Toast'        → from '@op/ui-next/Toast'
from '@op/ui/AlertBanner'  → from '@op/ui-next/AlertBanner'
from '@op/ui/Pagination'   → from '@op/ui-next/Pagination'
from '@op/ui/Breadcrumbs'  → from '@op/ui-next/Breadcrumbs'
from '@op/ui/ToggleButton' → from '@op/ui-next/ToggleButton'
```

### API translation

| Old | New | Notes |
|---|---|---|
| `<TagGroup onRemove={(keys) => ...}>` | drop `onRemove` | tags handle their own remove now (render IconButton inside Tag) |
| `<Tag>` | same | renders Badge under the hood |
| `<Toast />` mounted in layout | same | renders shadcn Toaster |
| `toast.success({ title, message })` | same | translates to sonner's `toast.success(title, { description: message })` |
| `toast.error({ title, message, dismissable: false })` | same | maps `dismissable` → sonner's `dismissible` |
| `<AlertBanner intent="info"\|"warning"\|"danger"\|"success">` | same | maps `danger` → shadcn `destructive` variant |
| `<AlertBanner variant="banner">` | same | drops shadow for inline notice |
| `<Pagination range={{totalItems, itemsPerPage, page, label}} next previous>` | same | callback API, not link-based |
| `<Breadcrumb><Breadcrumbs>...</Breadcrumbs></Breadcrumb>` | same | auto-inserts separators |
| `<ToggleButton isSelected onChange>` | same | maps to shadcn Switch |

### Pitfalls

- **`AlertBanner` intents are tinted, not circle-indicator.** If you see callers passing `indicator` / `icon` props, those still work — but the visual is now a plain inline shadcn Alert with intent-tinted text + icon.
- **Toast: zero callers in apps use `children` or `actions` props.** If you find one, it'll have to render as a sonner.custom — flag for separate decision.
- **Pagination is callback-based (`next: () => void`), not link-based.** Don't confuse with shadcn's `<PaginationNext href>` link pattern.

### Commit message

```
refactor(app): migrate Tier 13 to @op/ui-next (TagGroup/Toast/AlertBanner/Pagination/Breadcrumbs/ToggleButton)

- Drop TagGroup.onRemove (Tag callers render their own remove button)
- toast.* now delegates to sonner native API via wrapper
- AlertBanner renders vanilla shadcn Alert (danger→destructive variant)
```

---

## Phase 3 — Cleanup (after all tiers merged)

### Goal
Remove `@op/ui` workspace; rename `@op/ui-next` to `@op/ui`.

### Procedure

1. **Verify no `@op/ui/*` imports remain anywhere:**
   ```bash
   grep -rn "from '@op/ui/" apps packages services 2>/dev/null | grep -v node_modules | grep -v ".next/" | grep -v "packages/ui/"
   ```
   Should return only matches inside `packages/ui/` itself (which is about to be deleted).

2. **Delete `packages/ui/`** workspace entirely.

3. **Rename `packages/ui-next` → `packages/ui`** at the filesystem level.

4. **In `packages/ui/package.json`:** change `"name": "@op/ui-next"` to `"name": "@op/ui"`.

5. **Codemod every `@op/ui-next/*` import → `@op/ui/*`** across `apps/`, `packages/`, `services/`.

6. **Update root `package.json`:** drop `"w:ui-next"` workspace alias; keep `"w:ui"`.

7. **Update `turbo.json`:** rename ui-next references to ui.

8. **Update `CLAUDE.md`:** drop ui-next-specific guidance; update `pnpm w:ui` workspace docs.

9. **Run `pnpm install`** (this one's fine to run — workspace topology changed).

10. **Run `pnpm w:ui typecheck && pnpm w:app typecheck`** — should be clean.

11. **Run `pnpm format:changes`.**

12. **Commit as one atomic change.** Don't split — phase 3 is a single rename PR.

### Commit message

```
chore: delete @op/ui, rename @op/ui-next → @op/ui

Migration to shadcn base-nova complete. The new package now owns the
@op/ui namespace going forward.
```

---

## Per-tier checklist (copy this into the PR description)

```
- [ ] grep'd all callers of the tier's @op/ui imports
- [ ] swapped imports
- [ ] applied API translations from the tier table
- [ ] handled named special cases listed in pitfalls
- [ ] pnpm w:ui-next typecheck passes
- [ ] pnpm w:app typecheck passes
- [ ] pnpm format:changes ran clean
- [ ] dev server smoke-tested the migrated screens
- [ ] commit message uses the template from the tier section
- [ ] PR opened as draft (per project convention)
```
