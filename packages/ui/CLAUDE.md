#### Intent UI Components

Intent UI is a shadcn-compatible component library built on React Aria. To add a component:
- Components use Intent UI / React Aria Components with Tailwind variants

1. **Browse components** at https://intentui.com/docs/components
2. **Fetch the component JSON** from `https://intentui.com/r/{component-name}.json` (e.g., `https://intentui.com/r/table.json`)
3. **Copy the component code** to `packages/ui/src/components/ui/{component}.tsx`
4. **Update imports** to use local paths:
   - `@/lib/primitive` → `@/lib/primitive` (already exists)
   - `@/hooks/use-media-query` → `@/hooks/use-media-query` (already exists)
   - Replace any icon imports with `react-icons/lu` (e.g., `import { LuChevronDown } from 'react-icons/lu'`)
5. **Add export** to `packages/ui/package.json` exports field
6. **Create Storybook story** in `packages/ui/stories/`
7. **Run `pnpm w:ui typecheck`** to verify

**Key files:**
- `packages/styles/intent-ui-theme.css` - Theme mapping to OP brand tokens
- `packages/ui/src/lib/primitive.ts` - `cx()` utility for React Aria render props
- `packages/ui/src/hooks/use-media-query.ts` - Media query hook

#### Component A11y Testing

Every story is scanned by axe via Storybook test-runner. WCAG 2A/AA + 2.1A/AA. Configured in `packages/ui/.storybook/test-runner.ts`. Run locally with `pnpm w:ui test:a11y:ci`.

CI runs the same scan but is **informational only** — it does not gate merging. The job uploads a `ui-a11y-report` artifact with violation details. Triage and fix existing debt incrementally; flip the CI job to gating once the library is clean.

When a story intentionally violates a rule (e.g. a contrast variant for design review), declare an exception in `parameters.a11y` with a one-line reason:

```ts
// Disable a specific rule (preferred)
export const LowContrastVariant = {
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: false }], // reason: brand palette, see DESIGN-123
      },
    },
  },
};

// Disable all a11y checks for a story (rare — prefer rule-level)
export const Skipped = {
  parameters: { a11y: { disable: true } },
};
```

Prefer fixing over disabling. Every disable needs a reason comment.
