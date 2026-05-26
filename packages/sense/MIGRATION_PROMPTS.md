# `@op/ui` → vanilla shadcn (via `@op/sense/ui/*`) migration prompts

Phase-2 migration scripts. Each prompt is self-contained — hand it to a fresh agent to migrate a tier of `@op/ui` consumers to **vanilla shadcn primitives** (no compat wrappers).

**Strategy:** consumers rewrite to vanilla shadcn API in one pass — no halfway state via compat wrappers. The `@op/sense` package ships:

- `@op/sense/ui/*` — vanilla shadcn primitives (button, dialog, sheet, select, tabs, etc.). This is the migration target.
- A handful of **keeper** composites/customs at `@op/sense/<Name>` — these solve op-specific concerns that vanilla shadcn doesn't (DataTable, DatePicker, FacePile, OptionMenu, MultiSelectComboBox, AlertBanner, Avatar with gradient fallback, ProfileItem, Confetti, etc.).
- A handful of pure re-exports at `@op/sense/<Name>` (Card, Checkbox, Menu, RadioGroup, Field, Separator) for stable import paths.
- **No compat wrappers** for Button/IconButton/Modal/Sheet/Tabs/Select/TextField/NumberField/SearchField/ComboBox/Tooltip/ToggleButton. Consumers go directly to vanilla.

**Prerequisite:** the phase 1 ship of `@op/sense` has merged. The package exists side-by-side with `@op/ui`; both work.

---

## Shared rules — applies to every tier

Read this first before any tier prompt.

### Workflow

1. Read CLAUDE.md in repo root and at `packages/sense/`.
2. `grep -rn "from '@op/ui/<Component>'" apps packages services` (exclude `node_modules`, `.next/`, `packages/ui/`) to find every caller.
3. For each caller: read the file, **rewrite to vanilla shadcn API** per the tier's translation table. Don't just swap import paths.
4. Run `pnpm w:sense typecheck` then `pnpm w:app typecheck` (and any other touched workspace).
5. Run `pnpm format:changes`.
6. Commit. **Don't push, don't open a PR — those are manual.**

### Discipline

- **Stay in repo root.** Don't `cd` into subdirs. Use absolute paths or `pnpm w:<workspace> <cmd>` shortcuts.
- **Don't run `pnpm install` autonomously.** If a rebase or new dep is needed, ask the user.
- **Don't commit `.mcp.json`, `CLAUDE.md`, `pnpm-lock.yaml`, or `.claude/skills/`** unless they're part of the actual tier scope.
- **Format only after typecheck passes.** Don't format before fixing TS errors.
- **Avoid `any` and `as` assertions.** If a type is wrong, fix the source.
- **No comments explaining WHAT.** Only WHY when non-obvious. Don't reference the migration in comments.

### `@op/ui` → vanilla shadcn path map

This is the canonical pair list. Compat wrappers don't exist in sense for these — go straight to the vanilla shadcn import path.

```
@op/ui/Button         → @op/sense/ui/button       (Button)
@op/ui/IconButton     → @op/sense/ui/button       (Button with size="icon" / "icon-sm" / "icon-lg")
@op/ui/LoadingSpinner → @op/sense/LoadingSpinner  (keeper — has op color/size defaults)
@op/ui/Tooltip        → @op/sense/ui/tooltip      (Tooltip, TooltipTrigger, TooltipContent, TooltipProvider)
@op/ui/Modal          → @op/sense/ui/dialog       (Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger)
@op/ui/Sheet          → @op/sense/ui/sheet        (Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger)
@op/ui/Tabs           → @op/sense/ui/tabs         (Tabs, TabsList, TabsTrigger, TabsContent)
@op/ui/Select         → @op/sense/ui/select      (Select, SelectTrigger, SelectValue, SelectContent, SelectItem)
@op/ui/TextField      → @op/sense/ui/input + ui/field   (Input + Field + FieldLabel + FieldError + FieldDescription)
@op/ui/NumberField    → @op/sense/ui/input + ui/field   (Input type="number" + Field + numeric validation inline)
@op/ui/SearchField    → @op/sense/ui/input + ui/input-group   (Input + InputGroup with search icon)
@op/ui/ComboBox       → @op/sense/ui/combobox    (Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty)
@op/ui/ToggleButton   → @op/sense/ui/switch     (Switch, with checked/onCheckedChange)
@op/ui/Checkbox       → @op/sense/Checkbox       (re-export of ui/checkbox)
@op/ui/RadioGroup     → @op/sense/RadioGroup     (re-export of ui/radio-group)
@op/ui/Menu / ListBox → @op/sense/Menu           (re-export of ui/dropdown-menu)
@op/ui/OptionMenu     → @op/sense/OptionMenu     (keeper kebab-menu composite)
@op/ui/Surface        → @op/sense/Card           (keeper re-export of ui/card)
@op/ui/Card slots     → @op/sense/Card           (CardHeader/CardContent/CardFooter/CardTitle/CardDescription/CardAction)
@op/ui/Avatar         → @op/sense/Avatar         (keeper composite: gradient fallback from placeholder)
@op/ui/Chip           → @op/sense/Chip           (keeper, or @op/sense/ui/badge directly)
@op/ui/Skeleton       → @op/sense/Skeleton       (keeper, has SkeletonLine variant)
@op/ui/Separator      → @op/sense/Separator     (re-export)
@op/ui/Field          → @op/sense/Field          (re-export aggregation: Field, FieldLabel, FieldError, FieldDescription, FieldGroup, FieldSet, FieldLegend)
@op/ui/Field (TextArea) → @op/sense/Textarea     (Textarea — vanilla shadcn, accepts borderless via className)
@op/ui/Toast          → @op/sense/Toast          (keeper: <Toast /> mount + toast.status helper)
                          + `import { toast } from 'sonner'` for actual toast calls
@op/ui/AlertBanner    → @op/sense/AlertBanner   (keeper: intent → variant + tint composite over ui/alert)
@op/ui/Pagination     → @op/sense/Pagination    (keeper: callback API + range display)
@op/ui/Breadcrumbs    → @op/sense/Breadcrumbs   (keeper composite)
@op/ui/Header / Link / EmptyState / FooterBar / StatusDot / TagGroup
                      → @op/sense/<Name>         (keeper customs)
@op/ui/MultiSelectComboBox → @op/sense/MultiSelectComboBox  (keeper composite: chips + multiple flag)
@op/ui/DatePicker     → @op/sense/DatePicker     (keeper: Popover + Calendar over native Date)
@op/ui/Popover        → @op/sense/ui/popover    (Popover, PopoverTrigger, PopoverContent)
@op/ui/Dialog         → @op/sense/ui/dialog     (vanilla shadcn Dialog)
@op/ui/ListBox        → see Tier 5 ListBox special case (no direct primitive)
@op/ui/RAC ListBox    → see Tier 5 ListBox special case
@op/ui/RAC Table      → @op/sense/DataTable     (TanStack-Table-backed) OR @op/sense/Table (raw primitives)
@op/ui/Sidebar / RichTextEditor / Sortable / CollapsibleConfigCard / SplitPane / Stepper / PhaseStepper
                      → @op/sense/<Name>         (keeper composites)
@op/ui/ProfileItem / FacePile / MediaDisplay / AutoSizeInput / LogoLoop / NotificationPanel / SocialLinks
@op/ui/TranslateBanner / ReactionsButton / CommentButton / ReactionTooltip
@op/ui/HorizontalList / BannerUploader / AvatarUploader / FileDropZone / Confetti / Form
                      → @op/sense/<Name>         (keeper composites / customs)
```

### Pitfalls encountered during phase-0 (the consolidation experiment)

- **`variant="icon"` on the legacy Button forces a fixed square `size="icon"`.** If your migrated caller has icon + text, drop the icon variant. With vanilla Button you just pass `size="sm"` + render the icon + text.
- **`isDismissable` on Modal/Sheet is reason-filtered in the legacy API.** Vanilla `Dialog` / `Sheet` use `showCloseButton` + `onOpenChange`. If the caller needed to prevent outside-press/escape-key dismissal, gate the close inside `onOpenChange` and/or pass `showCloseButton={false}`.
- **Stale `pg_class.reltuples`** from `t.platform.getStats` is unreliable for overflow gates. Use `array.length` of the fetched list, not the stat.
- **Modal callers with `overflowClassName`/slide-up animation classes** are misusing Modal — migrate them to `<Sheet side="bottom">` instead. SiteHeader avatar drawer and ProposalCardMenu mobile menu were two such consumers.
- **Avoid `display: contents` wrappers** around children of `AvatarGroup` / any element using `-space-x-*`. Contents-display elements ignore margins, so negative-margin overlap silently fails.
- **`@internationalized/date` is gone.** DatePicker uses native `Date`. Replace `parseAbsoluteToLocal` / `toCalendarDate` / `.compare()` with `new Date(str)` + `.getTime()`.
- **Confetti must mount in a portal-safe context.** Modal injects it via `behindContent` slot on DialogContent so it shares the DialogPortal's z-stack but isn't inside the transformed popup. If you call `<Confetti />` standalone elsewhere, ensure no transformed ancestor.
- **`selectedKey`/`onSelectionChange` (RAC naming) → `value`/`onValueChange` (shadcn naming).** Mechanical rename in every Tabs/Select/RadioGroup caller.
- **`isSelected`/`onChange` (RAC) → `checked`/`onCheckedChange` (shadcn).** For Checkbox, Switch, RadioGroupItem.
- **`onPress` (RAC) → `onClick`.** For every button-like element.
- **`isDisabled` (RAC) → `disabled`.** For every form control.
- **Stories that did 3-way comparison (old/wrapped/raw)** become 2-way (old/raw) once compat wrappers are gone — the migration map IS old-to-raw.

---

## Tier 1 — Foundation buttons + spinners + tooltips

### Goal
Migrate every `Button`, `IconButton`, `LoadingSpinner`, `Tooltip` caller from `@op/ui` to vanilla shadcn primitives.

### Import swaps + API translation

| Old (`@op/ui`) | New (vanilla shadcn from `@op/sense/ui/button` etc) | Notes |
|---|---|---|
| `import { Button } from '@op/ui/Button'` | `import { Button } from '@op/sense/ui/button'` | |
| `<Button color="primary">` | `<Button>` (default variant) | |
| `<Button color="secondary">` | `<Button variant="outline">` | |
| `<Button color="destructive">` | `<Button variant="destructive">` | |
| `<Button color="ghost">` | `<Button variant="ghost">` | |
| `<Button color="gradient">` | `<Button>` + custom `className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground"` | Drop legacy color, inline tint |
| `<Button variant="primary">` | `<Button>` | drop |
| `<Button variant="link">` | `<Button variant="link">` | passes through |
| `<Button variant="pill">` | `<Button variant="secondary" className="border-0 bg-primary/10 text-primary hover:bg-primary/15">` | inline the teal-pill classes |
| `<Button variant="icon" size="small">` icon-only | `<Button size="icon-sm" variant="ghost">` | use vanilla icon size |
| `<Button variant="icon">` with text content | `<Button size="sm">{icon}{text}</Button>` | drop icon variant; shadcn buttons gap icon + text natively |
| `<Button size="small">` | `<Button size="sm">` | rename |
| `<Button size="medium">` | `<Button>` | default |
| `<Button size="inline">` | `<Button className="h-auto p-0 shadow-none">` | inline-style; use Link if it's really inline text |
| `<Button isDisabled>` | `<Button disabled>` | rename |
| `<Button isLoading>` | `<Button disabled>{loading ? <Spinner /> : 'Submit'}</Button>` | wrapper-level spinner gone; render inline |
| `<Button isPending>` | same as `isLoading` | |
| `<Button onPress={fn}>` | `<Button onClick={fn}>` | rename |
| `<Button unstyled>` | render plain `<button>` directly with the same className | drop wrapper entirely |
| `<IconButton size="small">` | `<Button size="icon-sm" variant="ghost">` | |
| `<IconButton size="medium">` | `<Button size="icon" variant="ghost">` | |
| `<IconButton size="large">` | `<Button size="icon-lg" variant="ghost">` | |
| `<IconButton variant="outline">` | `<Button size="icon" variant="outline">` | |
| `<ButtonLink href="...">` | `<a href={...} className={cn(buttonVariants({variant, size}), '...')}>...</a>` | shadcn pattern; use `import { buttonVariants } from '@op/sense/ui/button'` |
| `<LoadingSpinner>` | `import { LoadingSpinner } from '@op/sense/LoadingSpinner'` | keeper — keep import |
| `<TooltipTrigger><Trigger/><Tooltip>...</Tooltip></TooltipTrigger>` (RAC sibling) | `<TooltipProvider><Tooltip><TooltipTrigger render={<Trigger/>} /><TooltipContent>...</TooltipContent></Tooltip></TooltipProvider>` | shadcn nested pattern |
| Import from `@op/ui/Tooltip` | `import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@op/sense/ui/tooltip'` | |

### Verification

```bash
pnpm w:sense typecheck && pnpm w:app typecheck && pnpm format:changes
```

Visual smoke check: primary/secondary/destructive buttons, icon button with text, loading state, tooltip on hover.

### Commit message

```
refactor(app): migrate Tier 1 to vanilla shadcn (Button/IconButton/Spinner/Tooltip)

- @op/ui/Button → @op/sense/ui/button (color→variant, size renamed, onPress→onClick, isDisabled→disabled)
- @op/ui/IconButton → @op/sense/ui/button with size="icon-*"
- @op/ui/Tooltip RAC sibling pattern → @op/sense/ui/tooltip nested
- LoadingSpinner unchanged (keeper)
- Drop variant="icon" on text-bearing buttons (forced square size overflowed)
```

---

## Tier 2 — Layout & display atoms

### Goal
Migrate Header/Link/Surface/Skeleton/Avatar/Chip/Separator/StatusDot/EmptyState/FooterBar/CheckIcon. These are mostly keepers — the migration is a path swap to `@op/sense/<Name>`.

### Import swaps

```
from '@op/ui/Header'      → from '@op/sense/Header'
from '@op/ui/Link'        → from '@op/sense/Link'
from '@op/ui/Surface'     → from '@op/sense/Card'    (** symbol renamed Surface→Card **)
from '@op/ui/Skeleton'    → from '@op/sense/Skeleton'
from '@op/ui/Avatar'      → from '@op/sense/Avatar'
from '@op/ui/Chip'        → from '@op/sense/Chip'    (or @op/sense/ui/badge directly)
from '@op/ui/Separator'   → from '@op/sense/Separator'
from '@op/ui/StatusDot'   → from '@op/sense/StatusDot'
from '@op/ui/EmptyState'  → from '@op/sense/EmptyState'
from '@op/ui/FooterBar'   → from '@op/sense/FooterBar'
from '@op/ui/CheckIcon'   → from '@op/sense/CheckIcon'
```

### Codemod for Surface → Card

```
- import { Surface } from '@op/ui/Surface';
+ import { Card } from '@op/sense/Card';

- <Surface className="p-4 ...">...</Surface>
+ <Card className="p-4 ...">...</Card>
```

The Card primitive has no built-in padding — keep whatever `p-*` the caller already adds. Don't migrate Surface callers into structured Card slot composition unless the user asks; that's per-feature work.

### Commit message

```
refactor(app): migrate Tier 2 to @op/sense (layout/display atoms)

- Header/Link/Skeleton/Avatar/Chip/Separator/StatusDot/EmptyState/FooterBar/CheckIcon path-swapped
- Surface → Card (renamed)
```

---

## Tier 3 — Form atoms

### Goal
Highest-volume tier. Rewrite every TextField/NumberField/SearchField/Select/Checkbox/RadioGroup/Tabs caller to vanilla shadcn API.

### TextField → Input + Field

```tsx
// Old
<TextField
  label="Name"
  value={name}
  onChange={setName}
  errorMessage={errors.name}
  description="Your full name"
  isRequired
  inputProps={{ placeholder: 'Jane Doe', maxLength: 50 }}
/>

// New
import { Field, FieldLabel, FieldDescription, FieldError } from '@op/sense/ui/field';
import { Input } from '@op/sense/ui/input';

<Field data-invalid={!!errors.name}>
  <FieldLabel>
    Name{errors.name && <span aria-hidden> *</span>}
  </FieldLabel>
  <Input
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="Jane Doe"
    maxLength={50}
    aria-invalid={!!errors.name || undefined}
  />
  {errors.name ? (
    <FieldError>{errors.name}</FieldError>
  ) : (
    <FieldDescription>Your full name</FieldDescription>
  )}
</Field>
```

**`onChange` is now a native event handler** — call `e.target.value` instead of receiving the bare string.

### TextField with `useTextArea` → Textarea

```tsx
// Old
<TextField useTextArea value={x} onChange={setX} textareaProps={{ rows: 3 }} />

// New
import { Textarea } from '@op/sense/Textarea';
<Textarea value={x} onChange={(e) => setX(e.target.value)} rows={3} />
```

### NumberField → Input type="number" + validation inline

```tsx
// Old
<NumberField label="Amount" value={n} onChange={setN} minValue={0} maxValue={100} prefixText="$" />

// New: compose with InputGroup if you need the prefix slot.
import { InputGroup, InputGroupAddon, InputGroupInput } from '@op/sense/ui/input-group';

<Field>
  <FieldLabel>Amount</FieldLabel>
  <InputGroup>
    <InputGroupAddon align="inline-start">$</InputGroupAddon>
    <InputGroupInput
      type="number"
      min={0}
      max={100}
      value={n}
      onChange={(e) => setN(Number(e.target.value))}
    />
  </InputGroup>
</Field>
```

### SearchField → InputGroup with search icon

```tsx
import { LuSearch } from 'react-icons/lu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@op/sense/ui/input-group';

<InputGroup>
  <InputGroupAddon align="inline-start">
    <LuSearch className="size-4" />
  </InputGroupAddon>
  <InputGroupInput
    placeholder="Search…"
    value={q}
    onChange={(e) => setQ(e.target.value)}
  />
</InputGroup>
```

### Select → vanilla shadcn Select

```tsx
// Old
<Select selectedKey={k} onSelectionChange={setK} items={items} label="Plan">
  {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
</Select>

// New
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@op/sense/ui/select';

<Field>
  <FieldLabel>Plan</FieldLabel>
  <Select value={k} onValueChange={setK}>
    <SelectTrigger>
      <SelectValue placeholder="Pick one" />
    </SelectTrigger>
    <SelectContent>
      {items.map((item) => (
        <SelectItem key={item.id} value={item.id}>
          {item.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</Field>
```

### Checkbox → keeper re-export

```tsx
// Old
<Checkbox isSelected={b} onChange={setB} aria-label="..." />

// New
import { Checkbox } from '@op/sense/Checkbox';
<Checkbox checked={b} onCheckedChange={setB} aria-label="..." />
```

### RadioGroup → keeper re-export

```tsx
// Old
<RadioGroup value={v} onChange={setV}>
  <Radio value="a">A</Radio>
  <Radio value="b">B</Radio>
</RadioGroup>

// New
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { FieldLabel } from '@op/sense/ui/field';

<RadioGroup value={v} onValueChange={setV}>
  <FieldLabel><RadioGroupItem value="a" /> A</FieldLabel>
  <FieldLabel><RadioGroupItem value="b" /> B</FieldLabel>
</RadioGroup>
```

### Tabs → vanilla shadcn Tabs

```tsx
// Old
<Tabs selectedKey={k} onSelectionChange={setK}>
  <TabList>
    <Tab id="a" variant="pill">A</Tab>
    <Tab id="b" variant="pill">B</Tab>
  </TabList>
  <TabPanel id="a">A content</TabPanel>
  <TabPanel id="b">B content</TabPanel>
</Tabs>

// New
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@op/sense/ui/tabs';

<Tabs value={k} onValueChange={setK}>
  <TabsList>
    <TabsTrigger value="a">A</TabsTrigger>
    <TabsTrigger value="b">B</TabsTrigger>
  </TabsList>
  <TabsContent value="a">A content</TabsContent>
  <TabsContent value="b">B content</TabsContent>
</Tabs>
```

**`variant="pill"` is gone.** Vanilla shadcn TabsTrigger has no pill variant. If the design needs it, override on the trigger:

```tsx
<TabsTrigger value="a" className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary">A</TabsTrigger>
```

### Commit message

```
refactor(app): migrate Tier 3 to vanilla shadcn (form atoms)

- TextField → Input + Field (event-based onChange)
- NumberField → Input type=number + InputGroup for prefix
- SearchField → InputGroup with search icon
- Select → ui/select (selectedKey→value, items+children→map)
- Checkbox: isSelected→checked, onChange→onCheckedChange
- Radio → RadioGroupItem; value/onChange→value/onValueChange
- Tabs: selectedKey→value, Tab→TabsTrigger, TabPanel→TabsContent; Tab variant="pill" inlined as data-state classes
```

---

## Tier 4 — Overlays (Modal, Sheet, Popover)

### Goal
Rewrite every Modal/Sheet/Popover caller to vanilla shadcn Dialog / Sheet / Popover.

### Modal → Dialog

```tsx
// Old
<Modal isOpen={open} onOpenChange={setOpen} isDismissable>
  <ModalHeader>Title</ModalHeader>
  <ModalBody>Body</ModalBody>
  <ModalFooter>
    <Button onPress={() => setOpen(false)}>Close</Button>
  </ModalFooter>
</Modal>

// New
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@op/sense/ui/dialog';
import { Button } from '@op/sense/ui/button';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <div className="text-sm">Body</div>
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- `isOpen` → `open`. `onOpenChange` stays.
- `isDismissable={false}` → `<DialogContent showCloseButton={false}>` + handle escape/outside-press in `onOpenChange`:
  ```tsx
  onOpenChange={(open, details) => {
    if (!open && details?.reason === 'escape-key') return; // ignore
    setOpen(open);
  }}
  ```
- `confetti` → caller adds `<Confetti />` inside `DialogContent` (or pass via `behindContent` slot if your DialogContent supports it).

### Sheet → vanilla Sheet

```tsx
// Old
<Sheet isOpen={open} onOpenChange={setOpen} side="bottom" isDismissable>
  <SheetHeader>Title</SheetHeader>
  <SheetBody>Body</SheetBody>
</Sheet>

// New
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@op/sense/ui/sheet';

<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="bottom">
    <SheetHeader>
      <SheetTitle>Title</SheetTitle>
    </SheetHeader>
    <div className="p-4">Body</div>
  </SheetContent>
</Sheet>
```

### Bottom-anchored Modal misuse

If you encounter a `Modal` with `overlayClassName`/`className` containing `slide-in-from-bottom`, that's a slide-up sheet misusing Modal. Migrate it to `<Sheet side="bottom">` (SiteHeader avatar drawer and ProposalCardMenu mobile menu are two such consumers — see phase-0 commits for reference).

### Popover → ui/popover

```tsx
// Old (RAC sibling pattern)
<DialogTrigger>
  <Button>Open</Button>
  <Popover>
    <Dialog>...</Dialog>
  </Popover>
</DialogTrigger>

// New
import { Popover, PopoverTrigger, PopoverContent } from '@op/sense/ui/popover';

<Popover>
  <PopoverTrigger render={<Button>Open</Button>} />
  <PopoverContent>...</PopoverContent>
</Popover>
```

### Commit message

```
refactor(app): migrate Tier 4 to vanilla shadcn (Modal/Sheet/Popover)

- Modal → Dialog (isOpen→open, isDismissable→showCloseButton + reason-filter)
- Sheet → vanilla Sheet (same API translation)
- Bottom-anchored Modal misuse → Sheet side="bottom" (SiteHeader, ProposalCardMenu)
- Popover RAC sibling → ui/popover nested
```

---

## Tier 5 — Menus (Menu, OptionMenu, ListBox)

### Goal
Migrate dropdown menus.

### Menu → DropdownMenu

```tsx
// Old
<MenuTrigger>
  <Button>Open</Button>
  <Popover>
    <Menu>
      <MenuItem onAction={fn}>Edit</MenuItem>
    </Menu>
  </Popover>
</MenuTrigger>

// New
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@op/sense/Menu';

<DropdownMenu>
  <DropdownMenuTrigger render={<Button>Open</Button>} />
  <DropdownMenuContent>
    <DropdownMenuItem onClick={fn}>Edit</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### OptionMenu keeper

```
from '@op/ui/OptionMenu' → from '@op/sense/OptionMenu'
```

API mostly preserved; one signature change:
- `size="small" | "medium" | "large"` → `size="icon-sm" | "icon" | "icon-lg"`

### ListBox special case

There's no direct ListBox primitive in vanilla shadcn. Three replacement strategies depending on use case:

1. **Search-result dropdown (custom portal):** Use `<div role="listbox">` with `role="option"` buttons. See `ShareProposalModal.tsx` for the pattern.
2. **Multi-select chip-input:** Use `@op/sense/MultiSelectComboBox` (keeper composite).
3. **In-modal select list:** Use `@op/sense/ui/combobox` for typing-driven or `@op/sense/ui/select` for picker-style.

### Commit message

```
refactor(app): migrate Tier 5 to @op/sense (menus)

- Menu/MenuItem RAC → DropdownMenu/DropdownMenuItem (Menu re-export of ui/dropdown-menu)
- ListBox use cases replaced per-site (role=listbox/option divs, MultiSelectComboBox, or Combobox)
- OptionMenu kebab-menu keeper: size names changed (small→icon-sm)
```

---

## Tier 6 — Display composites

### Goal
Migrate ProfileItem, FacePile (+GrowingFacePile merge), MediaDisplay, AutoSizeInput, LogoLoop, PhaseStepper, HorizontalList, NotificationPanel, Stepper, SocialLinks, TranslateBanner, ReactionsButton, CommentButton, ReactionTooltip.

### Import swaps (mostly path swaps)

```
from '@op/ui/ProfileItem'       → from '@op/sense/ProfileItem'
from '@op/ui/FacePile'          → from '@op/sense/FacePile'
from '@op/ui/GrowingFacePile'   → from '@op/sense/FacePile'  (** merged **)
from '@op/ui/MediaDisplay'      → from '@op/sense/MediaDisplay'
... (all others one-to-one)
```

### FacePile merger

`GrowingFacePile` no longer exists. Use `<FacePile maxItems={N}>` instead — that mode triggers a ResizeObserver + `+N` overflow chip.

```tsx
// Old
<GrowingFacePile maxItems={20} items={items} />

// New
<FacePile maxItems={20} items={items} />
```

### Pitfall: FacePile items must produce DOM elements

Don't wrap items in `<span className="contents">` — margins can't apply to display:contents children, so AvatarGroup's `-space-x-2` overlap will fail silently.

### Commit message

```
refactor(app): migrate Tier 6 to @op/sense (display composites)

- ProfileItem/FacePile/MediaDisplay + 9 smaller path swaps
- GrowingFacePile → FacePile with maxItems (merged)
```

---

## Tier 7 — Form composites & uploaders

### Goal
Migrate Form, BannerUploader, AvatarUploader, FileDropZone, ComboBox, MultiSelectComboBox.

### Import swaps

```
from '@op/ui/Form'                → from '@op/sense/Form'
from '@op/ui/BannerUploader'      → from '@op/sense/BannerUploader'
from '@op/ui/AvatarUploader'      → from '@op/sense/AvatarUploader'
from '@op/ui/FileDropZone'        → from '@op/sense/FileDropZone'
from '@op/ui/MultiSelectComboBox' → from '@op/sense/MultiSelectComboBox'
from '@op/ui/ComboBox'            → from '@op/sense/ui/combobox'   (** vanilla **)
from '@op/ui/Field' (TextArea)    → from '@op/sense/Textarea'
```

### ComboBox → vanilla shadcn Combobox

```tsx
// Old
<ComboBox items={items} selectedKey={k} onSelectionChange={setK}>
  {(item) => <ComboBoxItem id={item.id}>{item.label}</ComboBoxItem>}
</ComboBox>

// New
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from '@op/sense/ui/combobox';

<Combobox<{ id: string; label: string }>
  items={items}
  itemToStringLabel={(i) => i.label}
  itemToStringValue={(i) => i.id}
  value={items.find((i) => i.id === k) ?? null}
  onValueChange={(next) => setK(next?.id ?? null)}
>
  <ComboboxInput placeholder="Search…" />
  <ComboboxContent>
    <ComboboxEmpty>No matches</ComboboxEmpty>
    <ComboboxList>
      {(item) => (
        <ComboboxItem key={item.id} value={item}>{item.label}</ComboboxItem>
      )}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

### MultiSelectComboBox keeper

API unchanged: `<MultiSelectComboBox items value onChange placeholder allowAdditions enableLocalSearch isDisabled />`.

### Commit message

```
refactor(app): migrate Tier 7 to @op/sense (form composites)

- Form/BannerUploader/AvatarUploader/FileDropZone/MultiSelectComboBox path-swapped
- ComboBox → vanilla ui/combobox (selectedKey→value via item lookup)
- TextArea (from @op/ui/Field) → Textarea (vanilla shadcn)
```

---

## Tier 8 — SplitPane / Sidebar

### Goal
Migrate `SplitPane` (4 known consumers) and `Sidebar` (9 known consumers). Both keeper composites — straight path swap.

```
from '@op/ui/SplitPane' → from '@op/sense/SplitPane'
from '@op/ui/Sidebar'   → from '@op/sense/Sidebar'
```

### Pitfall

`SplitPane` previously used `selectedKey/onSelectionChange`. New version uses `value/onValueChange` per shadcn Tabs convention. If a caller passes `selectedKey`, rename to `value`.

### Commit message

```
refactor(app): migrate Tier 8 to @op/sense (SplitPane + Sidebar)
```

---

## Tier 9 — Editor composites

### Goal
Migrate RichTextEditor, Sortable, CollapsibleConfigCard (17 sites).

### Import swaps

```
from '@op/ui/RichTextEditor'        → from '@op/sense/RichTextEditor'
from '@op/ui/Sortable'              → from '@op/sense/Sortable'
from '@op/ui/CollapsibleConfigCard' → from '@op/sense/CollapsibleConfigCard'
```

### Pitfall

`CollapsibleConfigCard` old API had `variant="unstyled"` and used Accordion under the hood. New version uses Collapsible primitive; collapsing is opt-in via `isCollapsible`. Drop `variant="unstyled"`, replace `isExpanded` with the prop name matching the new API.

### Commit message

```
refactor(app): migrate Tier 9 to @op/sense (RichTextEditor/Sortable/CollapsibleConfigCard)

- 17 sites path-swapped
- CollapsibleConfigCard drops variant="unstyled" (Collapsible primitive replaces Accordion)
```

---

## Tier 10 — Tables (DataTable + raw Table primitives)

### Goal
Migrate 10 known table consumers from RAC `<Table>` to either `@op/sense/DataTable` (TanStack-Table-backed) or `@op/sense/ui/table` raw primitives.

### Old imports to remove

```
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, EditableCell } from '@op/ui/ui/table';
```

### New imports

```
import { DataTable, type ColumnDef, type SortingState } from '@op/sense/DataTable';
// — OR for custom skeletons / non-tanstack tables:
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@op/sense/ui/table';
```

### Critical patterns

1. **`<RowCells>` components that render multiple `<TableCell>`** don't exist in TanStack — each column gets its own cell renderer. Inline the JSX into ColumnDef cell renderers. Delete the Row component file when done.

2. **Per-row local state shared across multiple cells** (e.g. UsersTable's "selected org" dropdown that drove the Role column's display) must be **lifted to a parent map** keyed by row id. Cell renderers read/write via the lifted map:
   ```tsx
   const [selectedByRow, setSelectedByRow] = useState<Record<string, string>>({});
   const setForRow = (rowId: string, v: string) =>
     setSelectedByRow((prev) => ({ ...prev, [rowId]: v }));
   ```

3. **Sort state translation** for RAC `SortDescriptor`-driven tables:
   ```tsx
   const sorting: SortingState = [{
     id: descriptor.column,
     desc: descriptor.direction === 'descending',
   }];

   const handleSortingChange = (next: SortingState) => {
     const [first] = next;
     if (!first) {
       onSortChange({ column: 'name', direction: 'ascending' });
       return;
     }
     onSortChange({
       column: first.id,
       direction: first.desc ? 'descending' : 'ascending',
     });
   };
   ```
   Mark sortable columns via `enableSorting: true` on the ColumnDef.

4. **`EditableCell` is gone.** Replace with inline conditional inside a `TableCell`:
   ```tsx
   <TableCell>
     {isEditing ? <EditForm /> : displayValue}
   </TableCell>
   ```

5. **Skeleton tables** keep using `@op/sense/ui/table` raw primitives directly. DataTable is overkill for skeletons.

6. **`header` field on ColumnDef accepting JSX:** wrap in function `() => <span/>`, not pass JSX directly — type only allows string or function.

### Commit message

```
refactor(app): migrate Tier 10 to vanilla shadcn (RAC tables → DataTable / ui/table)

- 10 consumers swapped (PlatformAdmin Decisions/Orgs/Users, ProfileUsersAccess, etc)
- Delete *Row.tsx files; inline cell logic into ColumnDef[]
- Per-row shared state lifted to parent map (UsersTable role/org pair)
- SortDescriptor ↔ SortingState adapter for sortable tables
- EditableCell replaced with inline {isEditing ? <Form/> : value}
- RolesSection kept on ui/table primitives (per-row edit state doesn't fit TanStack)
```

---

## Tier 11 — DatePicker + tiny ports

### Goal
Migrate DatePicker (1 consumer) and the remaining `@op/ui` imports for Popover/Dialog/ListBox/RAC/Field.

### DatePicker keeper

```
from '@op/ui/DatePicker' → from '@op/sense/DatePicker'
```

The API uses native `Date` instead of `@internationalized/date`. Replace:

```tsx
// Old
import { parseAbsoluteToLocal, toCalendarDate } from '@internationalized/date';
<DatePicker value={toCalendarDate(parseAbsoluteToLocal(str))} onChange={(d) => save(formatCalendarDate(d))} />

// New
<DatePicker value={new Date(str)} onChange={(d) => save(d.toISOString())} />
```

Comparisons: `start.getTime() < end.getTime()` (not `.compare()`).

### Tiny ports

- `from '@op/ui/Field' { TextArea }` → `from '@op/sense/Textarea' { Textarea }`
- `from '@op/ui/Popover'` → `from '@op/sense/ui/popover'` (see Tier 4)
- `from '@op/ui/Dialog'` → `from '@op/sense/ui/dialog'`
- `from '@op/ui/ListBox' | '@op/ui/RAC'` → see Tier 5 ListBox special case

### CollaborativeMultiSelectField special case

If you encounter `CollaborativeMultiSelectField` (yjs-synced multi-select), rebuild it on `@op/sense/MultiSelectComboBox`. Drop the bespoke `DialogTrigger` + `Popover` + `ListBox` composition.

### Commit message

```
refactor(app): migrate Tier 11 to @op/sense (DatePicker + tiny ports)

- DatePicker: native Date throughout, drop @internationalized/date
- TextArea (from @op/ui/Field) → Textarea (vanilla shadcn)
- CollaborativeMultiSelectField: rebuild on MultiSelectComboBox
- ShareProposalModal: ListBox → role=listbox/option button list
```

---

## Tier 12 — Polish & last stragglers

### Goal
Wrap up remaining keeper path swaps: TagGroup, Toast, AlertBanner, Pagination, Breadcrumbs.

### Import swaps

```
from '@op/ui/TagGroup'     → from '@op/sense/TagGroup'
from '@op/ui/Toast'        → from '@op/sense/Toast' (mount) + import { toast } from 'sonner' (calls)
from '@op/ui/AlertBanner'  → from '@op/sense/AlertBanner'
from '@op/ui/Pagination'   → from '@op/sense/Pagination'
from '@op/ui/Breadcrumbs'  → from '@op/sense/Breadcrumbs'
```

### Toast rewrite

The compat `toast.success({title, message})` is gone. Replace with sonner native:

```tsx
// Old
import { toast } from '@op/ui/Toast';
toast.success({ title: 'Saved', message: 'Settings updated.' });
toast.error({ message: 'Try again' });
toast.status({ code: 404 });  // status helper preserved

// New
import { toast } from 'sonner';
import { toast as opToast } from '@op/sense/Toast';  // for status helper only

toast.success('Saved', { description: 'Settings updated.' });
toast.error('Try again');
opToast.status({ code: 404 });  // canned-copy status helper unchanged
```

`<Toast />` mount component (rendered once in the root layout) stays the same import: `import { Toast } from '@op/sense/Toast'`.

### AlertBanner

Path swap. API mostly preserved: `intent={'info'|'warning'|'danger'|'success'|'default'}`, `indicator`, `icon`, `variant={'default'|'banner'}`, `fullWidth`.

### TagGroup

Path swap. Drop the `onRemove` prop — tags handle their own remove buttons now (render an `<IconButton>` or vanilla Button inside Tag).

### Commit message

```
refactor(app): migrate Tier 12 to @op/sense (Toast/AlertBanner/TagGroup/Pagination/Breadcrumbs)

- toast.success({title,message}) → sonner native toast.success(title, {description})
- toast.status helper kept (op-specific HTTP-code → canned-copy)
- TagGroup.onRemove dropped (tags own their close buttons)
- AlertBanner/Pagination/Breadcrumbs path-swapped
```

---

## Phase 3 — Cleanup (after all tiers merged)

### Goal
Remove `@op/ui` workspace; rename `@op/sense` → `@op/ui`.

### Procedure

1. **Verify no `@op/ui/*` imports remain:**
   ```bash
   grep -rn "from '@op/ui/" apps packages services 2>/dev/null | grep -v node_modules | grep -v ".next/" | grep -v "packages/ui/"
   ```
   Should return only matches inside `packages/ui/` itself.

2. **Delete `packages/ui/`** workspace entirely.

3. **Rename `packages/sense` → `packages/ui`** at the filesystem level.

4. **`packages/ui/package.json`:** change `"name": "@op/sense"` → `"@op/ui"`.

5. **Codemod every `@op/sense/*` import → `@op/ui/*`** across `apps/`, `packages/`, `services/`.

6. **Root `package.json`:** drop `"w:sense"` alias; keep `"w:ui"`.

7. **`turbo.json`:** rename sense references.

8. **`CLAUDE.md`:** drop sense-specific guidance; update `pnpm w:ui` workspace docs.

9. **Run `pnpm install`** (workspace topology changed — exception to the no-autonomous-install rule).

10. **Run `pnpm w:ui typecheck && pnpm w:app typecheck`** — clean.

11. **Run `pnpm format:changes`.**

12. **Commit as one atomic change.** Don't split.

### Commit message

```
chore: delete @op/ui, rename @op/sense → @op/ui

Migration to shadcn base-nova complete. The new package owns the @op/ui
namespace going forward.
```

---

## Per-tier PR checklist (copy into PR description)

```
- [ ] grep'd all callers of the tier's @op/ui imports
- [ ] rewrote each caller to vanilla shadcn API per tier translation table
- [ ] handled named special cases listed in pitfalls
- [ ] pnpm w:sense typecheck passes
- [ ] pnpm w:app typecheck passes
- [ ] pnpm format:changes ran clean
- [ ] dev server smoke-tested the migrated screens
- [ ] commit message uses the template from the tier section
- [ ] PR opened as draft (per project convention)
```
