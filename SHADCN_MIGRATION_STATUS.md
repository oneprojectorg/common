# Status Report — `@op/ui` → shadcn (via Taki) Migration

## Where we are

**Branch:** `full-shadcn`, 9 commits on top of `dev`. Typecheck green across `@op/ui` + `apps/app`.

```
56fd354c2 feat(ui): rewrite Checkbox, RadioGroup, Select, ComboBox, Menu on Taki
88a5c6222 feat(ui): rewrite Tooltip, IconButton, ToggleButton, Breadcrumbs, TagGroup on Taki
51514d48b format
da8809e98 chore: ignore .gstack/ and .pnpm-store/
947af4c80 feat(ui): rewrite Button on Taki primitive
91e73d968 feat(ui): split Table into shadcn HTML Table + RAC DataTable
6b3cd651b feat(ui): pull Taki primitives into src/components/ui
389c31f69 chore(ui): switch components.json registry to Taki
28ebafbbc chore(styles): add shadcn-named theme tokens
```

## Done

### Foundation

- `packages/styles/shadcn-theme.css` maps shadcn-standard CSS vars to OP brand values. Imported alongside `intent-ui-theme.css` in `shared-styles.css`.
- 48 Taki primitives vendored in `packages/ui/src/components/ui/`. Path aliases rewritten. 7 files carry `// @ts-nocheck` (Taki ships them with strictness mismatches against tsgo).
- Table split: `./ui/table` = Taki static HTML, `./ui/data-table` = preserved Intent RAC table (TableColumn, EditableCell, sortDescriptor, selectionMode). 9 app consumers retargeted.
- Deps added: `lucide-react`, `next-themes`, `sonner`.
- `components.json` swapped from `@intentui` to `@taki`.

### Components rewritten on Taki (11 of 24 from the bucket)

| Component | Approach | Notes |
| --- | --- | --- |
| Button | wrapper preserving legacy API | maps `variant`/`color`/`size` (small/medium/inline) to Taki variants; isLoading via Taki isPending |
| ButtonLink | wrapper | mirrors Button |
| ButtonTooltip | wrapper | composes Button + Tooltip |
| IconButton | wrapper | maps `small`/`medium`/`large` → Taki `icon-sm`/`icon`/`icon-lg`; `ghost`/`solid`/`outline` → Taki `ghost`/`secondary`/`outline` |
| ToggleButton | wrapper | drops legacy knob-slider visual; `small` → `sm` |
| Tooltip | re-export + thin TooltipTrigger wrapper | `delay=500` default preserved |
| Breadcrumbs | re-export | adds `BreadcrumbLink` for clickable items; updated 2 app consumers |
| TagGroup | re-export | drops legacy color context |
| Checkbox / CheckboxGroup | re-export | drops `size`, `shape`, `borderColor`, `labelClassName` |
| RadioGroup | re-export | drops `labelClassName` |
| Select | re-export | drops `customTrigger`, `buttonClassName`, `popoverProps`, `selectValueClassName`, `variant=pill`, `size` |
| ComboBox | re-export | drops `popoverProps`, `buttonProps` |
| Menu | re-export + MenuItemSimple alias | drops `unstyled`, `selected` (use `selectionMode` + `isSelected`) |

17 app consumers updated to drop the dropped props.

## Bucket: Taki-backed primitives still on legacy code (13 deferred)

Each one has substantial custom domain logic that doesn't map 1:1 to a Taki primitive. They're already RAC-based, so visual migration is mostly class-by-class token swaps (`text-neutral-black` → `text-foreground`, `bg-primary-tealWhite` → `bg-accent`, etc.) — best done with the designer to confirm each surface.

| Component | Why deferred |
| --- | --- |
| **Dialog / Modal** | `ModalHeader` (sticky header + close X), `ModalBody`, `ModalFooter`, `ModalStepper` (step navigation), `ModalContext` (programmatic close), `surface=default/flat`, optional `Confetti` |
| **Sheet** | `SheetHeader` (with onClose), `SheetBody`, `side=bottom/left/right` slide-in animations |
| **Popover** | submenu offset detection via `useSlottedContext`, `showArrow` with custom SVG arrow |
| **Toast** | full sonner integration with `toast.success`/`error`/`status`, custom dismissable wrappers, single-line vs multi-line layouts, status code mapping |
| **Tabs** | `variant=pill` used in 22 places across Tabs, Buttons, Selects |
| **Pagination** | custom `PaginationRange`/`PaginationNavigation` with totalItems/itemsPerPage logic — not a Taki concept |
| **Calendar / DatePicker** | rich custom locale/calendar logic |
| **TextField / SearchField / NumberField** | char counter, `maxLength` UX, `useTextArea` toggle, prefix support, bounds validation, error precedence |
| **Field** | `Label`, `Description`, `FieldError`, `FieldGroup`, `Input`, `InputWithIcon`, `TextArea`, `inputStyles`, `fieldGroupStyles` — load-bearing across the rest |
| **Form** | trivial RACForm wrapper; not enough surface to wrap |

## Bucket: Partial-match rewrites (~10) — not yet started

Skeleton+SkeletonLine, Chip→Badge, LoadingSpinner→Spinner, Accordion→Disclosure, MultiSelectComboBox, OptionMenu, DropDownButton, CommentButton, ReactionsButton, ReactionTooltip.

## Bucket: Bespoke restyles to shadcn tokens (~30) — not yet started

Link, Surface, Sidebar, RichTextEditor, PhaseStepper, Stepper, ShaderBackground, MediaDisplay, ProfileItem, CategoryList, NotificationPanel, AvatarUploader, BannerUploader, FileDropZone, HorizontalList, CollapsibleConfigCard, EmptyState, FooterBar, Header, SocialLinks, AutoSizeInput, AlertBanner, FacePile, GrowingFacePile, Avatar, Confetti, LogoLoop, TranslateBanner, Sortable.

## Open decisions

1. **Visual fidelity policy.** `--primary` resolves to OP teal — Figma shadcn kit lands on OP brand. Designers may want pure shadcn neutrals + brand only on accent.
2. **Type scale.** OP custom (`text-title-lg`, etc.) still alongside shadcn defaults. Choose drop / keep / hybrid.
3. **Intent residue.** `intent-ui-theme.css` still imported, `accordion.tsx` still Intent, legacy `focusRing` still in `utils/index.ts`.
4. **PR strategy.** Ship now? The current branch lands ~50% of the bucket cleanly with green typecheck.

## Risks / debt

- 7 vendored Taki files carry `@ts-nocheck` (date-picker, input-group, range-calendar, search-field, slider, text-field, toggle-button-group) — pending fix when each is rewritten.
- 9 autostashes from rebase aftermath remain in `git stash list`.
- Some legacy components (LocaleChooser custom trigger) lost UX detail when consumer-side code was simplified to drop unsupported props.

## Recommended next steps

1. **Open PR for everything done.** Get design + eng eyes on the 11 rewrites and the foundation.
2. **Designer pairing** to confirm visual mapping before tackling the 13 deferred components.
3. **Class-by-class token swap** for the deferred bucket (`text-neutral-black` → `text-foreground`, etc.). Mechanical, low API risk, high visual impact.
4. **Stash cleanup** when confident: `git stash drop` × 9.

## Reference

- Tokens: `packages/styles/{shadcn-theme,intent-ui-theme,tokens,shared-styles}.css`
- Vendored Taki: `packages/ui/src/components/ui/*.tsx`
- Legacy components: `packages/ui/src/components/*.tsx`
- Subpath exports: `packages/ui/package.json` `exports`

## Reference: how Taki components were pulled

The pull/transform helpers were used once and discarded. To re-pull or update Taki components:

1. Fetch JSON from `https://taki-ui.com/r/{name}.json`.
2. Write `files[].content` to `packages/ui/src/components/ui/{name}.tsx`.
3. Rewrite imports: `@/lib/utils` → `../../lib/utils`, `@/registry/new-york/ui/X` → `./X`, fix any stray `../lib/utils`.
4. Strip unused `import React`. For files with structural type errors against tsgo, prefix `// @ts-nocheck` until rewrite.
5. Install any new npm deps from `dependencies` array.
