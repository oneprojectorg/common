# Plan: Reevaluate the Schema of the Category Field

## Problem

Category is implemented as a special-cased "locked system field" with inconsistent schema representations across the stack:

| Layer | Format | Problem |
|---|---|---|
| Backend writes (`updateProcess.ts`, `updateInstance.ts`) | `{ enum: ["Education", null] }` | Flat string array, no labels |
| Frontend expects (`ProposalFormRenderer.tsx`) | `{ oneOf: [{ const: "val", title: "Label" }] }` | Richer, standard JSON Schema |
| Template editor creates (`proposalTemplate.ts`) | `createLockedFieldSchema('dropdown', ...)` | No enum values at all |
| Instance config stores (`updateDecisionInstance.ts`) | `config.categories: ProposalCategory[]` | `{ id, label, description }` — separate from template |

The backend writes `enum`, the frontend reads `oneOf`, and the template editor writes neither.

## Goal

Unify category as a first-class variant of the dropdown field type using JSON Schema's `oneOf` pattern consistently across the stack.

## Plan

### Step 1: Converge on `oneOf` as the canonical schema format

The `oneOf: [{ const: "value", title: "Label" }]` pattern is already consumed by `extractOneOfOptions` in the renderer. Both dropdown and category should write this format.

### Step 2: Make category a dropdown with `x-format: 'category'`

- The `XFormat` type already has `'category'` (`types.ts:21`)
- A category field becomes `{ type: 'string', 'x-format': 'category', oneOf: [...] }`
- Locked/system-field behavior stays (controlled by `SYSTEM_FIELD_KEYS` and `ensureLockedFields`)
- Only difference from regular dropdown: options sourced from `config.categories` instead of inline-editable

### Step 3: Kill the `enum` write path in backend

Replace `enum: [...categories, null]` writes in `updateProcess.ts` (lines 146-149) and `updateInstance.ts` (lines 178-181) with `oneOf` format.

### Step 4: Have `ensureLockedFields` inject category options into the template

Currently (`proposalTemplate.ts:464`) it creates a bare `createLockedFieldSchema('dropdown', label)` with no options. It should pull from `config.categories` and populate `oneOf` values so the schema is self-contained.

### Step 5: Migrate regular dropdowns to `oneOf` too

`createFieldJsonSchema('dropdown')` at `proposalTemplate.ts:84` currently writes `enum`. Migrating to `oneOf` means `extractOneOfOptions` becomes the single reader for all select-like fields. `getFieldOptions` (lines 171-177) that reads `enum` gets replaced.

## Risks / Gotchas

- **Data migration**: Existing templates in the DB have `enum` format. Need a backwards-compatible reader or a migration pass.
- **Junction table**: `proposalCategories` + taxonomy system stays unchanged — that's normalized storage. The schema change only affects the template/form layer.
- **Already anticipated**: `CollaborativeCategoryField` comment says: "NOTE: `x-format: 'category'` may be replaced by a generic select/enum widget in the future"

## Sizing

Medium-effort refactor touching ~8-10 files across `packages/common`, `services/api`, and `apps/app`. No DB migrations needed. Hardest part is backwards compatibility with existing stored templates — a read-time normalization function (enum → oneOf) handles that.

## Files Involved

- `packages/common/src/services/decision/schemas/types.ts` — `ProposalCategory`, `ProcessConfig`
- `packages/common/src/services/decision/types.ts` — `XFormat` type
- `packages/common/src/services/decision/updateProcess.ts` — enum write path
- `packages/common/src/services/decision/updateInstance.ts` — enum write path
- `packages/common/src/services/decision/updateDecisionInstance.ts` — config.categories storage
- `apps/app/src/components/decisions/proposalTemplate.ts` — `ensureLockedFields`, `createFieldJsonSchema`
- `apps/app/src/components/decisions/proposalEditor/ProposalFormRenderer.tsx` — `extractOneOfOptions`
- `apps/app/src/components/decisions/proposalEditor/ProposalEditor.tsx` — validation
- `apps/app/src/components/collaboration/CollaborativeCategoryField.tsx` — render component
- `apps/app/src/components/decisions/ProcessBuilder/stepContent/template/TemplateEditorContent.tsx` — template editor
