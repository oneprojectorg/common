# @op/sense — agent guide

`@op/sense` is the design system. It is shadcn/ui in its **Base UI** style,
themed by `@op/styles`.

[`README.md`](./README.md) explains what the package is and why. This file is
how to work in it.

## Where component documentation lives

Three places, in the order you should reach for them. There is deliberately no
fourth — no per-component markdown file, because a doc that sits beside code
without being compiled or rendered goes stale silently.

1. **The component source** — `src/components/ui/<name>.tsx` (primitives) or
   `src/components/<Name>/index.tsx` (composites). **Read the source before
   using a component you don't know.** The `cva` variant definition is the
   authoritative list of `variant` / `size` values; nothing else restates it, so
   nothing else can disagree with it.
2. **The story** — `<component>.stories.tsx`, right next to it. Shows real
   usage, the interesting states, and the a11y-relevant cases. If you need to
   know how something is composed, the story is the worked example.
3. **Storybook** — `pnpm w:sense dev` → http://localhost:3600. The rendered form
   of 1 and 2: generated props tables plus live examples, with an **A11y** panel
   per story.

### Where to write documentation

The two halves of the package have different answers, because one of them is
overwritable:

- **Composites are hand-written and never regenerated**, so **JSDoc is their API
  documentation**. Every composite gets a JSDoc block on the component saying
  what it is and when to reach for it, plus JSDoc on any prop a caller couldn't
  infer from its type. Storybook renders these into the props table, your editor
  shows them on hover, and an agent reads them while already in the file — one
  source, three consumers.
- **Primitives are generated and `shadcn add <name>` will overwrite them.**
  Don't document the registry's API in the file; that's upstream's job and your
  prose will be silently deleted. Do JSDoc **our deviations** — a variant we
  added, a default we changed, a behaviour that surprised us — and expect to
  reapply it after a regeneration, exactly like the "Known upstream patches"
  list in `README.md`. Everything else about a primitive belongs in its story,
  which regeneration does not touch.

When you add or change a component, the story is not optional and it is part of
the same change. A component with no story is undocumented.

---

## Recipe: build a UI with sense

1. **Find the component before writing one.** Check `package.json#exports` for
   the full list of public components. Prefer a sense component over a raw HTML
   element — `Button` over `<button>`, `Header1` over `<h1>`, `Field` over a
   hand-rolled label. If nothing fits, compose primitives; only then consider a
   new composite.
2. **Import per component.** `import { Button } from '@op/sense/Button'`. There
   is no barrel export.
3. **Import `cn` from sense**: `import { cn } from '@op/sense/lib/utils'`, never
   stock `twMerge`. Ours registers the custom type tokens with `tailwind-merge`;
   the wrong one silently drops `text-title` / `font-strong` whenever a
   `className` merges a colour in.
4. **Use semantic classes only.** `bg-primary`, `text-muted-foreground`,
   `border-input`. Never a raw token (`bg-teal-500`), never an arbitrary value
   (`text-[14px]`, `bg-[#333]`).
5. **Use logical properties.** `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`,
   `text-start`/`text-end`. Never `ml-`/`pl-`/`left-`/`text-left`. The app ships
   Arabic.
6. **Wrap every user-facing string in `t()`** — `useTranslations` in client
   components, `await getTranslations()` in server components. This includes `aria-label`,
   `alt`, and any string passed to a sense component as copy (sense itself is
   i18n-agnostic and takes copy as props).
7. **Do the four a11y things** listed below.
8. **Verify**: `pnpm typecheck` then `pnpm format`.

### The four accessibility obligations

Base UI handles focus management, roving tabindex, typeahead, `aria-expanded` /
`aria-controls` / `aria-selected` wiring, dismissal, and scroll locking. Do not
reimplement or work around any of it. These four are yours:

1. **Name every icon-only control.** `<Button size="icon-sm"><LuX /></Button>` is
   a nameless button. Add `aria-label={t('Close')}`. This is the single most
   common defect in this codebase.
2. **Label every input.** `Field` + `FieldLabel`, or `htmlFor` matching the
   control's `id`. A placeholder is not a label.
3. **Announce content that changes without a navigation.** Async results, live
   counts, validation errors, save states → `aria-live="polite"` on the region
   that updates.
4. **Keep clickable things focusable and semantic.** A clickable card or row
   needs a real `Button` or link inside it. Never an `onClick` on a `div`. If a
   whole surface must be clickable, use `Button variant="bare"`, which keeps
   button semantics without imposing button styling.

Also: anything that animates needs a `motion-reduce:` branch, and any
directional icon needs `rtl:-scale-x-100`.

Check your work in the **A11y** panel of the component's story — it runs axe
against whatever is on screen, live.

---

## Recipe: add a primitive from the shadcn registry

Primitives are generated and regenerable. Treat `src/components/ui/` as output.

```bash
pnpm w:sense dlx shadcn@latest add <component>
```

Run it from this package only — the app has no `components.json`, by design, so
primitives cannot land outside the design system.

Then:

1. **Add the export.** In `package.json#exports`:
   ```jsonc
   "./<PascalName>": "./src/components/ui/<kebab-filename>.tsx"
   ```
   Keep the object alphabetised. Skipping this gives consumers
   `Cannot find module '@op/sense/<PascalName>'` — that is the drift signal, so
   don't work around it.
2. **Fix the imports.** The CLI writes `@/lib/utils` and `@/components/ui/x`.
   Rewrite them to **relative** paths — `../../lib/utils`, `./button` — matching
   the rest of the package.
3. **Do not restyle it to use OP tokens.** This is the most common mistake. A
   generated primitive should use only shadcn's semantic classes
   (`bg-primary`, `text-muted-foreground`, `border-input`). Those already resolve
   to OP values through `packages/styles/theme.css`. If it looks wrong, the bug
   is in the semantic mapping — fix `theme.css`, not the component. Editing a
   primitive's colours makes it unregenerable and takes it out of the theme.
4. **Do check these four things**, which the mapping cannot do for you:
   - **Logical properties.** `components.json` sets `"rtl": true` so the CLI
     emits `ms-`/`ps-`/`start-`, but it can't do everything. Calendar,
     Pagination and Sidebar are on shadcn's manual list — Sidebar in particular
     keys physical positions off a physical `side`, so a blind rename breaks the
     pair. Rotated elements keep **physical** corners: `rounded-tl` on a
     `rotate-45` arrow is its tip, and `rounded-ss` moves the rounding to a side
     in RTL. Icons flip via `rtl:-scale-x-100` — keep to that spelling.
   - **`space-x-*` needs nothing.** Tailwind v4 already emits
     `margin-inline-end`. The CLI's `rtl:space-x-reverse` is a v3 holdover and
     *introduces* a bug here — delete it.
   - **Sizing against our scale.** Our default control height is `h-11` (44px),
     `sm` is `h-8`. Registry defaults differ; match the existing primitives.
   - **`dark:` classes.** The app has no dark mode. Leave stock `dark:` classes
     where the registry put them, but never add new ones.
5. **Write a story** at `src/components/ui/<kebab-filename>.stories.tsx`:
   `title: 'Primitives/<PascalName>'`, `tags: ['autodocs']`, a `Default`, one
   story per meaningful variant axis, and a story for any a11y-relevant state.
6. **Add JSDoc** for anything a caller couldn't guess from the type.
7. **Record any patch.** If you had to modify registry output to make it
   compile, add it to the "Known upstream patches" list in `README.md` so the
   next regeneration reapplies it.
8. `pnpm typecheck`, `pnpm w:sense build`, `pnpm format`.

---

## Recipe: add a composite

Composites are ours and are never overwritten by a tool.

1. **Create `src/components/<PascalName>/index.tsx`.** One directory per
   composite; the story lives beside it.
2. **Compose primitives with relative imports** — `../ui/button`,
   `../ui/dialog`. Not `@op/sense/Button`: internal restructuring shouldn't
   require touching the public API. (Stories are the exception — they import
   through the public subpath so they document what a consumer actually writes.)
3. **File order**: types and interfaces at the top, then the main exported
   component, then private sub-components and helpers below. The primary export
   should be findable near the top.
4. **Keep it i18n-agnostic.** Sense components take copy as props with English
   defaults; they never call `t()`. The app passes translated strings in.
5. **Take `className` and merge it with `cn`.** Every composite should be
   restylable at the call site without a new prop.
6. **Push behaviour into a primitive when you can.** If two composites need the
   same thing, it belongs in `components/ui/` or in the primitive itself, not
   copied.
7. **Add the export** to `package.json#exports`:
   `"./<PascalName>": "./src/components/<PascalName>/index.tsx"`.
8. **JSDoc the component and its non-obvious props**, and write
   `index.stories.tsx` with `title: 'Composites/<PascalName>'`.
9. `pnpm typecheck`, `pnpm w:sense build`, `pnpm format`.

---

## Base UI behaviours that bite

Hard-won; each of these cost real debugging time.

- **`Select.Value` renders the raw value, not the label.** A `<Select>` with
  id-style values (`value="en"`) displays `en`, not `English`. Pass the
  value→label map to the Select root's `items` prop, or keep `value === label`.
- **Guard `data-*` variants with an explicit `=true`.** Base UI and cmdk stamp
  `data-selected="false"` as well as `"true"`, and a bare `data-selected:`
  matches *both*. Always write `data-[selected=true]:`. (Symptom: every item in
  a list renders as selected.)
- **Menu labels must sit inside a `*MenuGroup`** or Base UI throws error #31.
- **Menus and dropdowns need an explicit `*Content` wrapper** and
  `*Trigger asChild`.
- **Cancel a built-in handler with `event.preventBaseUIHandler()`** in a user
  handler that runs first — that's the supported escape hatch, not
  `stopPropagation`.
- **Base UI uses native DOM prop names**: `disabled`, `onClick`, `checked`,
  `loading` — not React Aria's `isDisabled`, `onPress`, `isSelected`.
- **`render` instead of a separate link component.** There is no `ButtonLink`;
  render an anchor through the button:
  `<Button render={<Link href="/next" />} variant="link">`.
- **`data-icon="inline-start" | "inline-end"`** on an icon inside a `Button` or
  `Badge` tightens the padding on that side. Logical, so it flips correctly.
- **`Tooltip` hover delay defaults to 100ms** app-wide; pass `delay={500}` at a
  call site that wants the slower feel.
- **`SkeletonText` defaults to `lines={3}`.** Set it to match the real content
  rather than copying a number from elsewhere.

## Never

- Edit a primitive in `components/ui/` to use OP tokens or literal colours.
- Add `@op/sense` as a runtime dependency of anything inside this package — it's
  a leaf. (Stories self-reference via the public subpath; that's resolved by
  Node's self-reference support and needs no dependency entry.)
- Add a public component without a `package.json#exports` entry.
- Add a `className="sense"` wrapper. Tokens live on `:root`; there is no scope
  class, and adding one does nothing.
- Use `text-title-*` (e.g. `text-title-lg`) — that's the retired pre-sense scale.
  The sense scale is `text-label` / `text-title` / `text-headline` /
  `text-display`.
- Use `any`, a type assertion (`as`), or a non-null assertion (`!`) to get
  something to compile.
- Log through `console.*`.

## Verify

```bash
pnpm typecheck        # whole repo, not just this package
pnpm w:sense build    # every story has to compile and bundle
pnpm format
```

`pnpm w:sense build` and `dev` call Storybook directly, so on a fresh clone run
`pnpm build` once first — `@op/styles` resolves to a generated
`dist/styles.css`, and without it you get
`Failed to resolve entry for package "@op/styles"`. CI runs
`turbo build --filter=@op/sense`, which compiles the dependency first.

Then open the component's story in `pnpm w:sense dev` and read the **A11y**
panel. Axe runs against whatever is on screen, so a violation there is a real
violation — fix it before opening the PR.

Nothing enforces that panel in CI yet. The headless gate
(`@storybook/addon-vitest`) is blocked on an upstream Vite/ESM break between
`@testing-library/dom` and `aria-query@5.3.0`; see `README.md`. Until it lands,
reading the panel is a manual step you owe — don't skip it because CI is quiet.
