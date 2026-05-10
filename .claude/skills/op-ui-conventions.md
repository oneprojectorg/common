---
name: op-ui-conventions
description: How to use the @op/ui component library, design tokens, and the type scale. Use whenever rendering UI in apps/app or any package that imports React.
---

## Components

- Always prefer `@op/ui` over native HTML — `<Button>` not `<button>`, `<Heading>` not `<h2>`, etc.
- Import per-component: `import { Button } from "@op/ui/Button"`. The library is exported via `package.json` exports field.
- Source: `packages/ui/src/`. Storybook stories sit alongside each component.

## Colors

- Use token-mapped Tailwind classes: `text-primary-teal`, `bg-neutral-gray1`, etc.
- **Never** use arbitrary hex values like `bg-[#333]` or `text-[#abc]`.
- Token source of truth: `packages/styles/tokens.css` (`--op-*` CSS vars), mapped in `packages/styles/shared-styles.css`.

## Type scale

- Use the custom scale: `text-title-lg`, `text-title-md`, `text-sm`, `text-body`, etc., defined in `packages/styles/shared-styles.css`.
- Do **not** use raw Tailwind sizes (`text-[14px]`, `text-2xl`) unless that exact token is defined.

## When in doubt

Read `packages/ui/src/<component>` to confirm the API before introducing a new component.

## React/Next.js performance

For anything beyond layout — data fetching, dynamic imports, memoization, transitions — defer to the `vercel-react-best-practices` skill. It owns React/Next.js performance conventions in this repo.
