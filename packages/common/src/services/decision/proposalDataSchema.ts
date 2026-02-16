import { z } from 'zod';

import { type MoneyAmount, moneyAmountSchema } from '../../money';
import type { ProposalPropertySchema } from './types';

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
    category: z.string().nullish(),
    budget: budgetValueSchema,
    attachmentIds: z
      .array(z.string())
      .nullish()
      .transform((v) => v ?? []),
    collaborationDocId: z.string().nullish(),
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
    category: (raw.category as string) ?? undefined,
    budget: normalizeBudget(raw.budget),
    attachmentIds: (raw.attachmentIds as string[]) ?? [],
    collaborationDocId: (raw.collaborationDocId as string) ?? undefined,
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
  value: string;
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
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const { enum: _legacyEnum, ...rest } = existing ?? {};

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
 * the legacy `enum` format (`['value1', 'value2', null]`).  Null values
 * are filtered out — callers receive only user-visible options.
 */
export function parseSchemaOptions(
  schema: ProposalPropertySchema | null | undefined,
): SchemaOption[] {
  if (!schema) {
    return [];
  }

  // Canonical: oneOf with { const, title } entries
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf
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
 * Returns `true` when the schema contains a non-empty `oneOf` array
 * with at least one non-null string value.
 */
export function schemaHasOptions(
  schema: ProposalPropertySchema | null | undefined,
): boolean {
  return parseSchemaOptions(schema).length > 0;
}
