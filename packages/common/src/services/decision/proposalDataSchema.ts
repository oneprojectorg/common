import { z } from 'zod';

/**
 * Budget stored as `{ value, currency }` in proposalData.
 * Legacy proposals stored budget as a plain number — the schema normalizes
 * both shapes into this canonical form.
 */
export const budgetValueSchema = z
  .union([
    // New canonical shape
    z.object({ value: z.number(), currency: z.string() }),
    // Legacy: plain number → normalise to { value, currency: 'USD' }
    z
      .union([z.string(), z.number()])
      .pipe(z.coerce.number())
      .transform((n) => ({ value: n, currency: 'USD' })),
  ])
  .nullish();

/** Canonical budget shape inferred from `budgetValueSchema` */
export type BudgetData = NonNullable<z.infer<typeof budgetValueSchema>>;

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
 * Normalize a raw budget value into the canonical `BudgetData` shape
 * using `budgetValueSchema`. Accepts `{ value, currency }`, a plain number,
 * or a numeric string and returns `BudgetData | undefined`.
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
  return budget?.value ?? 0;
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
