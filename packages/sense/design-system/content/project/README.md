Sense is the design system behind **Common**, One Project's platform for participatory decisions and economic democracy. It is shadcn/ui in its Base UI style, themed by one token layer. A component looks like Common because the tokens say so, not because the component knows.

## Principles

- **Semantic first.** Use the role (`primary`, `muted-foreground`, `border`), never the raw ramp step (`color-teal-500`). The ramps exist so the roles have something to point at.
- **Tokens only.** No arbitrary values: no `14px`, no `#333`. A value you need twice and cannot find is a missing token.
- **Serif speaks, sans works.** Headings set in Roboto Serif at weight 400. Everything you click, read in a form, or scan in a list sets in Roboto.
- **Borders, not shadows.** Surfaces separate with a `border` hairline. Shadows are faint (`shadow-2xs`, `shadow-light`) and never carry structure.
- **Direction-neutral.** The product ships Arabic. Layout uses logical sides (start/end), never left/right.
- **Light only.** There is no dark theme. Do not add `dark:` styles.

## Content

- **Voice.** Plain, warm, collective. Speak to the member as "you"; speak for the platform rarely, as "we".
- **Casing.** Sentence case for everything: buttons, titles, menu items. "Submit proposal", not "Submit Proposal".
- **Buttons say the action.** A verb plus an object: "Create decision", "Invite members", "Save changes". Never "OK" or "Yes".
- **No emoji** in UI copy.
- **Every string is translated.** Components ship English defaults and take copy as props; the app passes translated strings.
- **Isolate user-authored text.** A proposal title or member name can run counter to the page direction. Wrap it in `<bdi>`; if it truncates, set `dir="auto"` and pin the alignment instead.

Real copy from the product: "Connecting people, organizations, and resources to coordinate and grow economic democracy to global scale."

## Colour

- **Brand hue is teal.** `primary` (teal-500 #387582) is the one action colour: default buttons, checked controls, links. Use `accent` (teal-50) with `accent-foreground` (teal-600) for a selected row or a quiet highlight.
- **Text.** `foreground` (gray-900) on every surface. `muted-foreground` (gray-600) for descriptions, captions and placeholders.
- **Surfaces.** `background` and `card` are white. `muted` (#fafbfb) for hover fills, disabled controls and card footers. `secondary` (gray-100) for neutral filled buttons and badges.
- **Lines.** `border` (gray-100) for hairlines. `input` (gray-300) for control outlines. `ring` (gray-400, drawn at 50%) for focus.
- **Status.** Each status has a solid and a muted fill: `destructive`/`destructive-muted`, `warning`/`warning-muted`, `success`/`success-muted`. Text on a muted fill is always `foreground`. A status always carries an icon or word too; colour alone never says it.
- **Charts.** `chart-1` to `chart-5` in order: orange, teal, blue, yellow, purple.
- **Gradients.** Brand gradients are radial blends used only for avatar fallbacks and hero art: teal to green (`bg-gradient`), red to teal, green to blue, purple to orange. Their off-ramp stops are the `brand-*` tokens.

### Known contrast gaps (kept as the source has them)

- `ring` on white is 2.2:1 and `input` on white is 1.5:1, both under the 3:1 for focus rings and control borders.
- `warning` as an icon on `warning-muted` is 2.7:1.
- `success-foreground` on `success` is 3.3:1: large text only.

## Type

- **Families.** `sans` is Roboto, as a variable font so `font-weight-strong` (450) renders true. `serif` is Roboto Serif at 300 and 400, with italics. Both stacks fall through to Rubik for Arabic script. `mono` is the system stack; there is no web mono. All the font files ship with this system.
- **Headings.** Set every heading in Roboto Serif at weight 400: use the `Header1`–`Header4` components, or `font-serif` with one of the four steps `text-label` < `text-title` < `text-headline` < `text-display`. Each step grows at 768px. All track tight (−0.01em to −0.025em). `text-label` is a small heading, not a form label.
- **Body.** `text-base` (16/24) for copy. `text-base font-strong` (450) for buttons, form labels and tabs. `text-sm` for descriptions; `text-xs font-strong` for badges.
- **Style names.** The type styles here are prefixed so they never clash with Tailwind: `serif-title` is the `text-title` step, `sans-base` is `text-base`. In component code use the Tailwind classes; the `serif-*` and `sans-*` classes are for plain HTML.
- **Never** use the `legacy-*` styles (`text-title-lg`, `text-title-base`, `text-title-sm14`) in new work. They survive only for stored rich text.
- **Avoid** `text-lg` and larger sans sizes: they are stock shadcn leftovers.

## Space, size and shape

- **Spacing** follows Tailwind's 4px step (`space-1` … `space-8`). Cards and alerts pad `space-4`.
- **Controls** are tall: `control-default` 44px for Buttons, Inputs and Tabs; `control-sm` 32px; `control-lg` 48px.
- **Radius.** `radius` (8px) is the default for buttons, inputs, cards and alerts. `radius-md` (6px) for small buttons and tabs. `radius-sm` (4px) for badges, Kbd and checkboxes. `radius-full` for avatars and switches.
- **Breakpoints.** Tailwind's defaults plus `breakpoint-xxs` (320px) and `breakpoint-xs` (480px).

## States

- **Hover** darkens a fill by mixing in 10% `foreground`; active mixes 15%. Outline and ghost controls hover to `muted`.
- **Focus** shows a 3px `ring` at 50% opacity and moves the border to `ring`. Only on keyboard focus.
- **Disabled** drops to 50% opacity and blocks the pointer.
- **Invalid** sets the border to `destructive` and a 3px `destructive` ring at 20%.
- **Press** nudges a button 1px down.
- **Motion** is short (200–300ms, ease-out). Every animation needs a reduced-motion branch.

## Accessibility

Base UI handles focus, keyboard and ARIA wiring. Four things are yours:

1. Give every icon-only button an accessible name.
2. Give every input a real label (`Field` + `FieldLabel`). A placeholder is not a label.
3. Mark content that changes without navigation with `aria-live="polite"`.
4. Make anything clickable a real control. Never put a click handler on a `div`; use `Button variant="bare"` when a whole surface is the target.

## Iconography

- **Icon set:** Lucide, through `react-icons/lu` (`LuCheck`, `LuCircleAlert`, `LuHourglass` …). 16px by default inside buttons and badges; 12px in xs controls. Stroke icons, `currentColor`.
- **Custom icons** live in `Icons`: `megaphone` and `check-circle`. The megaphone uses `currentColor` in code; the file here is inked `foreground` (#142426).
- **Directional icons** (arrows, chevrons) flip in RTL.
- **No emoji** as icons.

## Logos

- `common-wordmark` is the product name set in a warm orange gradient serif italic. Use it on white or `muted`.
- `common-wordmark-white` is for dark or photographic grounds.
- `op-ring` is the One Project ring mark: the favicon and app icon.
- Never redraw, recolour or stretch a mark.

## Using the components

Every component in `@op/sense` is here as the real React code, on `window.Sense`. Build with these components; do not restyle them or draw lookalikes.

- **Names match the package.** `import { Button } from '@op/sense/Button'` in the app is `Sense.Button` in a prototype. Compound parts sit beside their root: `Sense.Dialog`, `Sense.DialogTrigger`, `Sense.DialogContent`.
- **Read the card first.** Each component's guide lists its parts and its Storybook examples; the preview shows those stories live.
- **Wrap the page once** in `Sense.TooltipProvider`, and in `Sense.DirectionProvider` with `direction="rtl"` for Arabic.
- **Style with the same Tailwind classes** the app uses (`bg-primary`, `text-muted-foreground`, `text-title`, `font-strong`, `ms-2`). Only classes the components already use are compiled in.
- **Primitives vs composites.** Primitives (Button, Dialog, Select …) are shadcn/ui on Base UI. Composites (ProposalCard, PhaseStepper, FacePile …) are product pieces built from them; use one when it fits.
- **Copy is a prop.** Components ship English defaults; pass the text you want.

## Not synced

- **Network content** does not load in previews: Map tiles and remote avatar or media images.
- **Gradients** (`bg-gradient`, `bg-redTeal` …) are compiled into the stylesheet but are not tokens; only their stops are.
- **Animations** (accordion, count tick, wiggle, sweep) are not tokens.
