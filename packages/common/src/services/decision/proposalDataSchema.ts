import { z } from 'zod';

import { type MoneyAmount, moneyAmountSchema } from '../../money';
import type { XFormatPropertySchema } from './types';

const categoryValueSchema = z
  .union([z.string(), z.array(z.string()), z.null()])
  .nullish()
  .transform((value) => normalizeProposalCategories(value));

/**
 * Budget stored as `MoneyAmount` (`{ amount, currency }`) in proposalData.
 *
 * Accepts two input shapes and normalizes to `MoneyAmount`:
 * - `{ amount, currency }` — canonical
 * - plain number or numeric string — legacy, defaults to USD
 */
export const budgetValueSchema = z
  .union([
    // Canonical shape
    moneyAmountSchema,
    // Legacy: plain number → { amount, currency: 'USD' }
    z
      .union([z.string(), z.number()])
      .pipe(z.coerce.number())
      .transform((n) => ({ amount: n, currency: 'USD' })),
  ])
  .nullish();

/**
 * Canonical budget shape — an alias for `MoneyAmount`.
 * @deprecated Prefer `MoneyAmount` for new code.
 */
export type BudgetData = MoneyAmount;

/**
 * Zod schema for proposal data with known fields.
 * Uses looseObject to allow additional fields from custom proposal templates.
 * Handles backward compatibility where 'content' maps to 'description'.
 */
export const proposalDataSchema = z
  .looseObject({
    title: z.string().nullish(),
    description: z.string().nullish(),
    content: z.string().nullish(), // backward compatibility
    category: categoryValueSchema,
    budget: budgetValueSchema,
    attachmentIds: z
      .array(z.string())
      .nullish()
      .transform((v) => v ?? []),
    collaborationDocId: z.string().nullish(),
    /** TipTap version number stamped on submit. Not a source of truth for the current version. */
    collaborationDocVersionId: z.number().int().optional(),
  })

  .transform((data) => {
    // Handle backward compatibility: content → description
    if (data.content && !data.description) {
      data.description = data.content;
    }
    return data;
  });

/** Parsed proposal data with defaults applied */
export type ProposalData = z.infer<typeof proposalDataSchema>;

/** Input type for proposal data (before parsing/defaults) */
export type ProposalDataInput = z.input<typeof proposalDataSchema>;

export function normalizeProposalCategories(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? [raw]
      : [];

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parseCategoryFragmentValue(value: string): string[] {
  if (!value) {
    return [];
  }

  try {
    return normalizeProposalCategories(JSON.parse(value));
  } catch {
    return normalizeProposalCategories(value);
  }
}

export function formatProposalCategories(
  categories: string[],
  separator = ', ',
): string {
  return categories.join(separator);
}

/**
 * Normalize a raw budget value into a `MoneyAmount` using `budgetValueSchema`.
 * Accepts `{ amount, currency }`, `{ value, currency }` (legacy), a plain
 * number, or a numeric string.
 */
export function normalizeBudget(raw: unknown): BudgetData | undefined {
  const result = budgetValueSchema.safeParse(raw);
  return result.success ? (result.data ?? undefined) : undefined;
}

/**
 * Extract the numeric value from any budget representation.
 * Handles `BudgetData`, legacy plain numbers, and numeric strings.
 * Returns 0 when the input can't be parsed.
 */
export function extractBudgetValue(raw: unknown): number {
  const budget = normalizeBudget(raw);
  return budget?.amount ?? 0;
}

/**
 * Safely parse proposal data with fallback.
 * Returns typed ProposalData on success, or preserves raw input fields on failure.
 */
export function parseProposalData(proposalData: unknown): ProposalData {
  const result = proposalDataSchema.safeParse(proposalData);
  if (result.success) {
    return result.data;
  }

  // Fallback: preserve raw input fields if it's an object, with safe defaults
  const raw =
    proposalData && typeof proposalData === 'object'
      ? (proposalData as Record<string, unknown>)
      : {};

  return {
    ...raw,
    title: (raw.title as string) ?? undefined,
    description: (raw.description as string) ?? undefined,
    content: (raw.content as string) ?? undefined,
    category: normalizeProposalCategories(raw.category),
    budget: normalizeBudget(raw.budget),
    attachmentIds: (raw.attachmentIds as string[]) ?? [],
    collaborationDocId: (raw.collaborationDocId as string) ?? undefined,
    collaborationDocVersionId:
      (raw.collaborationDocVersionId as number) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Category / dropdown schema helpers
// ---------------------------------------------------------------------------
//
// New templates use the `oneOf` pattern (`[{ const, title }]`).
// Legacy templates use `{ enum: [..., null] }`.
// `parseSchemaOptions` handles both formats transparently.
// ---------------------------------------------------------------------------

/** A single selectable option extracted from a JSON Schema property. */
export interface SchemaOption {
  value: string | number;
  title: string;
}

/**
 * Build a category JSON Schema property from a list of category labels.
 *
 * @param categories  - Plain string labels (e.g. `['Infrastructure', 'Education']`).
 * @param existing    - The current schema for the field, if any. Existing
 *                      properties (like `title`) are preserved; the legacy
 *                      `enum` key is stripped.
 * @returns A JSON Schema object ready to be set as `properties.category`.
 */
export function buildCategorySchema(
  categories: string[],
  options?: {
    allowMultipleCategories?: boolean;
    requireCategorySelection?: boolean;
    existing?: Record<string, unknown>;
  },
): XFormatPropertySchema {
  const {
    allowMultipleCategories = false,
    requireCategorySelection = false,
    existing,
  } = options ?? {};
  const {
    enum: _legacyEnum,
    oneOf: _oneOf,
    type: _type,
    items: _items,
    minItems: _minItems,
    uniqueItems: _uniqueItems,
    ...rest
  } = existing ?? {};

  if (allowMultipleCategories) {
    return {
      ...rest,
      type: 'array',
      'x-format': 'dropdown',
      items: {
        type: 'string',
        oneOf: categories.map((category) => ({
          const: category,
          title: category,
        })),
      },
      uniqueItems: true,
      ...(requireCategorySelection ? { minItems: 1 } : {}),
    };
  }

  return {
    ...rest,
    type: ['string', 'null'],
    'x-format': 'dropdown',
    oneOf: [
      ...categories.map((c) => ({ const: c, title: c })),
      { const: null, title: '' },
    ],
  };
}

/**
 * Parse selectable options from a JSON Schema property.
 *
 * Handles both the canonical `oneOf` format (`[{ const, title }]`) and
 * the legacy `enum` format (`['value1', 'value2', null]`). Null values
 * are filtered out — callers receive only user-visible options.
 */
export function parseSchemaOptions(
  schema: XFormatPropertySchema | null | undefined,
): SchemaOption[] {
  if (!schema) {
    return [];
  }

  // Canonical: oneOf with { const, title } entries
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf
      .filter(
        (entry): entry is { const: string | number; title: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          'const' in entry &&
          (typeof (entry as Record<string, unknown>).const === 'string' ||
            typeof (entry as Record<string, unknown>).const === 'number') &&
          'title' in entry &&
          typeof (entry as Record<string, unknown>).title === 'string',
      )
      .map((entry) => ({ value: entry.const, title: entry.title }));
  }

  const itemSchema =
    typeof schema.items === 'object' &&
    schema.items !== null &&
    !Array.isArray(schema.items)
      ? schema.items
      : undefined;

  if (Array.isArray(itemSchema?.oneOf)) {
    return itemSchema.oneOf
      .filter(
        (entry): entry is { const: string; title: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          'const' in entry &&
          typeof (entry as Record<string, unknown>).const === 'string' &&
          'title' in entry &&
          typeof (entry as Record<string, unknown>).title === 'string',
      )
      .map((entry) => ({ value: entry.const, title: entry.title }));
  }

  if (Array.isArray(itemSchema?.enum)) {
    return itemSchema.enum
      .filter((value): value is string => typeof value === 'string')
      .map((value) => ({ value, title: value }));
  }

  // Legacy: plain enum array
  if (Array.isArray(schema.enum)) {
    return schema.enum
      .filter((v): v is string => typeof v === 'string')
      .map((v) => ({ value: v, title: v }));
  }

  return [];
}

/**
 * Check whether a JSON Schema property has selectable options.
 *
 * Returns `true` when the schema contains at least one non-null selectable
 * value.
 */
export function schemaHasOptions(
  schema: XFormatPropertySchema | null | undefined,
): boolean {
  return parseSchemaOptions(schema).length > 0;
}

export function schemaAllowsMultipleSelection(
  schema: XFormatPropertySchema | null | undefined,
): boolean {
  if (!schema) {
    return false;
  }

  return (
    schema.type === 'array' ||
    (Array.isArray(schema.type) && schema.type.includes('array'))
  );
}
