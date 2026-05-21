# Styling & Customization

See [customization.md](../customization.md) for theming, CSS variables, and adding custom colors.

## Contents

- Semantic colors
- Built-in variants first
- className for layout only
- No space-x-* / space-y-*
- Prefer size-* over w-* h-* when equal
- Prefer truncate shorthand
- No manual dark: color overrides
- Use cn() for conditional classes
- No manual z-index on overlay components

---

## Tokens — two namespaces

This repo runs both token systems side-by-side. Pick by file location:

- **Inside `packages/ui-next/` (and code consuming `@op/ui-next`)** — use shadcn tokens. The `@theme inline` block in `packages/ui-next/src/styles.css` aliases `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, plus `--sidebar-*` and `--chart-*`. So `bg-primary`, `text-muted-foreground`, `bg-background`, `text-foreground`, `border-border`, etc. all resolve.
  - **Theming**: ui-next ships stock zinc as base values. `apps/app/src/app/layout.tsx` imports `@op/styles` *after* `@op/ui-next/styles.css`, and `packages/styles/intent-ui-theme.css` re-declares `--primary` → op teal, `--secondary`/`--muted`/`--accent`/`--border`/`--ring` → op neutrals. So in the running app, shadcn tokens render with op colors. In isolation (Storybook for ui-next, tests without `@op/styles`) they render zinc — verify in the app when colors matter.
- **Inside legacy `@op/ui` / `apps/app/` code not on ui-next** — use op token-mapped classes (`bg-neutral-gray1`, `text-primary-teal`, `bg-neutral-offWhite`) from `packages/styles/tokens.css` mapped via `shared-styles.css`. Do not introduce shadcn tokens there.
- **Everywhere** — never raw Tailwind colors (`bg-blue-500`, `text-gray-600`).

**Incorrect (anywhere):**

```tsx
<div className="bg-blue-500 text-white">
  <p className="text-gray-600">Secondary text</p>
</div>
```

**Correct inside ui-next:**

```tsx
<div className="bg-primary text-primary-foreground">
  <p className="text-muted-foreground">Secondary text</p>
</div>
```

**Correct in legacy code:**

```tsx
<div className="bg-neutral-gray1 text-primary-teal">
  <p className="text-neutral-gray4">Secondary text</p>
</div>
```

If you need a color that exists in neither namespace, add a `--op-*` variable in `packages/styles/tokens.css` (legacy) or extend the `@theme inline` block in `packages/ui-next/src/styles.css` (ui-next) — never inline arbitrary values.

---

## No raw color values for status/state indicators

For positive, negative, or status indicators, use Badge variants or op token classes (e.g. `text-destructive` if defined) — never raw Tailwind colors.

**Incorrect:**

```tsx
<span className="text-emerald-600">+20.1%</span>
<span className="text-green-500">Active</span>
<span className="text-red-600">-3.2%</span>
```

**Correct:**

```tsx
<Badge variant="secondary">+20.1%</Badge>
<Badge>Active</Badge>
<span className="text-destructive">-3.2%</span>
```

If a status color is missing from the op tokens, add a `--op-*` variable in `packages/styles/tokens.css` (or ask the user) — do not reach for raw Tailwind.

---

## Built-in variants first

**Incorrect:**

```tsx
<Button className="border border-input bg-transparent hover:bg-accent">
  Click me
</Button>
```

**Correct:**

```tsx
<Button variant="outline">Click me</Button>
```

---

## className for layout only

Use `className` for layout (e.g. `max-w-md`, `mx-auto`, `mt-4`), **not** for overriding component colors or typography.

**Incorrect:**

```tsx
<Card className="bg-blue-100 text-blue-900 font-bold">
  <CardContent>Dashboard</CardContent>
</Card>
```

**Correct:**

```tsx
<Card className="max-w-md mx-auto">
  <CardContent>Dashboard</CardContent>
</Card>
```

To customize a component's appearance, prefer these approaches in order:
1. **Built-in variants** — `variant="outline"`, `variant="destructive"`, etc.
2. **Token classes** — shadcn tokens inside ui-next, op tokens elsewhere (see above).
3. **Add a variable** — extend `@theme inline` in `packages/ui-next/src/styles.css` (ui-next) or `--op-*` in `packages/styles/tokens.css` (legacy).

---

## No space-x-* / space-y-*

Use `gap-*` instead. `space-y-4` → `flex flex-col gap-4`. `space-x-2` → `flex gap-2`.

```tsx
<div className="flex flex-col gap-4">
  <Input />
  <Input />
  <Button>Submit</Button>
</div>
```

---

## Prefer size-* over w-* h-* when equal

`size-10` not `w-10 h-10`. Applies to icons, avatars, skeletons, etc.

---

## Prefer truncate shorthand

`truncate` not `overflow-hidden text-ellipsis whitespace-nowrap`.

---

## Use the op type scale only

Text size classes live in `packages/styles/shared-styles.css`. Use the defined scale (e.g. `text-title-lg`, `text-title-md`, `text-sm`, etc.). Never use a raw Tailwind size class we have not aliased.

**Incorrect:**

```tsx
<h2 className="text-2xl font-bold">Heading</h2>
<p className="text-[14px]">Body</p>
```

**Correct:**

```tsx
<h2 className="text-title-lg">Heading</h2>
<p className="text-sm">Body</p>
```

If a size you need is missing, add it to `shared-styles.css` — do not inline arbitrary values.

---

## Wrap user-facing strings

Every string a user can see must go through i18n. Client: `useTranslations()`. Server: `<TranslatedText>`. Strings copied in from registry blocks (login forms, dashboards, empty states) must be wrapped before merging.

**Incorrect:**

```tsx
<CardTitle>Team Members</CardTitle>
```

**Correct (client):**

```tsx
const t = useTranslations();
<CardTitle>{t('Team Members')}</CardTitle>
```

**Correct (server):**

```tsx
<CardTitle><TranslatedText>Team Members</TranslatedText></CardTitle>
```

---

## No manual dark: color overrides

Token classes handle light/dark via CSS variables — shadcn tokens via the `.dark` block in `ui-next/src/styles.css`, op tokens via `intent-ui-theme.css`. Never `bg-white dark:bg-gray-950`.

---

## Use cn() for conditional classes

Use the `cn()` utility from the project for conditional or merged class names. Don't write manual ternaries in className strings.

**Incorrect:**

```tsx
<div className={`flex items-center ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
```

**Correct (inside ui-next, using shadcn tokens):**

```tsx
import { cn } from "@/lib/utils"

<div className={cn("flex items-center", isActive ? "bg-primary text-primary-foreground" : "bg-muted")}>
```

In legacy code, swap the token names for op classes (e.g. `bg-primary-teal`, `bg-neutral-gray1`).

---

## No manual z-index on overlay components

`Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard` handle their own stacking. Never add `z-50` or `z-[999]`.
