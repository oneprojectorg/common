import { z } from 'zod';

import { type MoneyAmount, moneyAmountSchema } from '../../money';
import type { XFormatPropertySchema } from './types';

const categoryValueSchema = z
  .union([z.string(), z.array(z.string()), z.null()])
  .nullish()
  .transform((value) => normalizeProposalCategories(value));

/**
 * A money amount as it is actually written down — a number, or the string a
 * hand-written or imported document carries.
 *
 * Shared by the stored budget and the document fragment: a shape one reader
 * accepts and the other drops is how a budget renders on a card and reads
 * "Add budget" in the editor.
 *
 * `min(1)` after trimming because `Number('')` and `Number('  ')` are both `0`,
 * so a cleared-but-not-deleted `{"amount":""}` would otherwise read as a real
 * zero budget and get autosaved over the stored amount.
 */
const budgetAmountSchema = z
  .union([z.string().trim().min(1), z.number()])
  .pipe(z.coerce.number());

/**
 * Budget stored in proposalData.
 *
 * Accepts the canonical `{ amount, currency }` and the legacy bare number or
 * numeric string, and deliberately leaves `currency` **absent** when the stored
 * value names none rather than defaulting it.
 *
 * Stamping a default here is what made the original bug unfixable: a fabricated
 * `'USD'` is indistinguishable downstream from one the author actually chose,
 * so it outranked the process's configured currency, and the editor — which
 * saves back what it was handed — re-persisted the fabrication onto the row.
 * The gap is filled at render time by `resolveBudgetFallbackCurrency`, which
 * can then reach the template for exactly the budgets that named nothing.
 */
export const budgetValueSchema = z
  .union([
    // Canonical shape, with the currency made optional and the amount read as
    // loosely as `budgetFragmentObjectSchema` reads it. Extended from
    // `moneyAmountSchema` rather than restated, so a field added to the
    // canonical money shape reaches stored budgets too.
    //
    // The string amount matters as much as the currency: `{"amount":"5000",
    // "currency":"EUR"}` turns up on imported and hand-written rows, and
    // rejecting it here dropped the whole budget — the amount vanished from
    // every surface, and the stored EUR went with it, so the template's
    // currency then won a budget that had named its own. Readers can only
    // resolve from a parsed row if parsing reads every shape storage holds.
    //
    // Nothing about the currency may fail this branch: whatever fails it sends
    // the whole object to the numeric branch, which fails too, and the amount
    // disappears from the proposal entirely — the currency taking the budget
    // down with it. So no `min(1)` (readers treat a blank code as naming none,
    // see `getStoredBudgetCurrency`), and a `catch` for everything else a row
    // can hold: an explicit `null`, or the non-string an import wrote. Those
    // name no currency either, and the amount is not theirs to delete.
    moneyAmountSchema.extend({
      amount: budgetAmountSchema,
      currency: z.string().optional().catch(undefined),
    }),
    // Legacy: plain number → { amount } with no currency. The return type is
    // annotated so both branches produce one shape rather than a union TS
    // makes callers narrow before they can read `currency` at all.
    z
      .union([z.string(), z.number()])
      .pipe(z.coerce.number())
      .transform((n): { amount: number; currency?: string } => ({ amount: n })),
  ])
  .nullish();

/**
 * Location stored in proposalData (WGS84 / SRID 4326).
 *
 * Two granularities live here:
 * - `lat`/`lng` — the proposal's exact pin, unique to this submission and what
 *   the UI renders.
 * - `placeId`/`address`/`placeLat`/`placeLng` — the geocoded place (Google).
 *   `placeLat`/`placeLng` are the canonical place coordinate, which the
 *   deduplicated `locations` row stores so every proposal at the same place
 *   agrees on one point (see `syncProposalProfileLocation`).
 */
export const locationValueSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().optional(),
    placeId: z.string().optional(),
    placeLat: z.number().min(-90).max(90).optional(),
    placeLng: z.number().min(-180).max(180).optional(),
  })
  .nullish();

/** Canonical location shape stored in proposalData. */
export type LocationData = NonNullable<z.infer<typeof locationValueSchema>>;

/**
 * A budget with its currency resolved — an alias for `MoneyAmount`.
 *
 * What renderers take: by the time a budget reaches a screen the currency has
 * been resolved (fragment → stored → template), so it is never absent. Storage
 * uses {@link StoredBudget}, where it may be.
 *
 * @deprecated Prefer `MoneyAmount` for new code.
 */
export type BudgetData = MoneyAmount;

/**
 * A budget as stored in proposalData, where `currency` is absent for legacy
 * bare-number budgets and for rows written before the currency picker existed.
 * Resolve it with `resolveBudgetFallbackCurrency` before rendering.
 */
export type StoredBudget = NonNullable<z.infer<typeof budgetValueSchema>>;

/** Raw budget input accepted by `budgetValueSchema` (canonical or legacy). */
export type BudgetInput = z.input<typeof budgetValueSchema>;

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
    location: locationValueSchema,
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

/** Discriminated union for explicit proposal version checkpoints. */
export const checkpointVersionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('update') }),
]);

export type CheckpointVersion = z.infer<typeof checkpointVersionSchema>;

export function normalizeProposalCategories(raw: unknown): string[] {
  if (typeof raw === 'string') {
    try {
      return normalizeProposalCategories(JSON.parse(raw));
    } catch {
      return normalizeProposalCategories([raw]);
    }
  }

  const values = Array.isArray(raw) ? raw : [];

  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
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

/**
 * A parsed budget fragment in object form, currency optional.
 *
 * Looser than `moneyAmountSchema` on purpose: the fragment is hand-written
 * JSON from a collaborative document, so `{"amount":5000}` and
 * `{"amount":"5000","currency":"EUR"}` both turn up in real documents.
 * `moneyAmountSchema` rejects them outright, which would leave the editor pill
 * showing "Add budget" for a budget the cards still render. Here a missing
 * currency has a fallback to fill it, so both shapes are readable.
 */
const budgetFragmentObjectSchema = z.object({
  amount: budgetAmountSchema,
  // Accepted as written and trimmed by the reader below rather than rejected
  // here: a blank code makes the whole object fail to parse, and the fragment
  // would then fall through to the bare-number reader, which drops the
  // currency key the author may well have filled in. `catch` for the same
  // reason one step further out — a `null` or non-string currency must not
  // fail the object and take the amount with it.
  currency: z.string().optional().catch(undefined),
});

/**
 * Read a `budget` document fragment as it is written, leaving `currency`
 * absent when the fragment names none.
 *
 * The fragment is written as `{"amount":N,"currency":"..."}`, but legacy and
 * imported documents hold a bare number or free text, so fall back to
 * normalizing the raw string. Returns `undefined` when the text carries no
 * usable amount.
 *
 * What the editor persists: writing back a currency the fragment never named
 * pins the proposal to whatever code happened to be resolved when someone
 * opened it. Use {@link parseBudgetFragmentValue} to *render* the fragment,
 * where the gap does have to be filled.
 */
export function parseStoredBudgetFragmentValue(
  text: string,
): StoredBudget | undefined {
  // Whitespace-only is unusable, not zero: `Number('  ')` is `0`, so without
  // this the fragment normalizes to a real `{amount: 0}` that the editor
  // autosaves over the stored budget.
  if (!text.trim()) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  // Object form first — it is the only shape that can name a currency.
  const object = budgetFragmentObjectSchema.safeParse(parsed);
  if (object.success) {
    const { amount } = object.data;
    // Trimmed, matching `getStoredBudgetCurrency`: a whitespace-only code
    // names a currency no more than an absent one does, and passing it through
    // makes `Intl` throw, dropping the currency marker entirely rather than
    // falling back to the process's.
    const currency = object.data.currency?.trim();
    return currency ? { amount, currency } : { amount };
  }

  // Bare number or numeric string — no currency to read.
  return normalizeBudget(parsed);
}

/**
 * Normalize the raw text of a `budget` document fragment for display, with its
 * currency resolved.
 *
 * `fallbackCurrency` is the currency already stored on the proposal, or the
 * template's where there is none (see `resolveBudgetFallbackCurrency`), and is
 * used only for fragments that name no currency of their own.
 *
 * Required rather than defaulted to `DEFAULT_BUDGET_CURRENCY`: two review
 * rounds each found a display surface that had simply forgotten to resolve one
 * and silently rendered dollars on a EUR process, which is why
 * `BudgetDisplay.fallbackCurrency` is a required prop. A default here puts that
 * footgun back one layer down, where it compiles clean and nothing on screen
 * looks wrong. Callers with genuinely nothing to resolve from pass the constant
 * themselves, and say so.
 */
export function parseBudgetFragmentValue(
  text: string,
  fallbackCurrency: string,
): BudgetData | undefined {
  const budget = parseStoredBudgetFragmentValue(text);
  return budget && withResolvedBudgetCurrency(budget, fallbackCurrency);
}

/**
 * Fill in the currency a budget names none of its own with, making it
 * renderable.
 *
 * The display counterpart of {@link withStoredBudgetCurrency}: this one may
 * fill the gap from anywhere, because nothing here is written back.
 *
 * The one place the "does this budget name a currency?" rule lives on the
 * display side. Open-coding it as `budget.currency || fallback` is what the
 * renderers used to do, and the copies drifted: they skipped the `trim()` that
 * every other reader here applies, so a row storing `"  "` — which
 * `budgetValueSchema` accepts verbatim — reached `Intl` as a currency code,
 * threw, and rendered the amount with no marker at all instead of the
 * process's.
 */
export function withResolvedBudgetCurrency(
  budget: StoredBudget,
  fallbackCurrency: string,
): BudgetData {
  return {
    amount: budget.amount,
    currency: resolveBudgetCurrencyCode(budget.currency, fallbackCurrency),
  };
}

/**
 * {@link withResolvedBudgetCurrency} for callers that need the code alone —
 * an input prefix, say, where the amount is rendered separately.
 */
export function resolveBudgetCurrencyCode(
  currency: string | undefined,
  fallbackCurrency: string,
): string {
  // Trimmed, matching every other reader: a whitespace-only code names a
  // currency no more than an absent one does.
  return currency?.trim() || fallbackCurrency;
}

/**
 * The budget a writer should persist, given the one already stored.
 *
 * Writers build the next budget from the document fragment, which names a
 * currency only when whoever wrote it filled one in. Persisting that verbatim
 * *deletes* a currency the proposal already stored — the amount survives, but
 * every surface drops to the process's currency (or USD) for a proposal that
 * had named its own.
 *
 * Not the stamping the design forbids: only a currency already chosen and
 * stored is carried across, never one resolved from the template or the
 * default. A budget that names its own currency keeps it; one written where
 * nothing was stored still names none.
 */
export function withStoredBudgetCurrency(
  budget: StoredBudget,
  storedCurrency: string | undefined,
): StoredBudget;
export function withStoredBudgetCurrency(
  budget: StoredBudget | undefined,
  storedCurrency: string | undefined,
): StoredBudget | undefined;
export function withStoredBudgetCurrency(
  budget: StoredBudget | undefined,
  /** The code the proposal's stored budget names, if any. */
  storedCurrency: string | undefined,
): StoredBudget | undefined {
  // `trim()` on both sides, matching `getStoredBudgetCurrency`: a blank code
  // names no currency, so it neither counts as one to keep nor as one to carry.
  if (!budget || budget.currency?.trim()) {
    return budget;
  }

  const currency = storedCurrency?.trim();
  return currency ? { ...budget, currency } : budget;
}

export function formatProposalCategories(
  categories: string[],
  separator = ', ',
): string {
  return categories.join(separator);
}

/**
 * Normalize a raw budget value into a `StoredBudget` using `budgetValueSchema`.
 * Accepts `{ amount, currency }`, a plain number, or a numeric string. The
 * currency stays absent when the raw value named none.
 */
export function normalizeBudget(raw: unknown): StoredBudget | undefined {
  const result = budgetValueSchema.safeParse(raw);
  return result.success ? (result.data ?? undefined) : undefined;
}

/**
 * Normalize a raw location value into `LocationData` using
 * `locationValueSchema`. Returns `undefined` for absent or malformed values —
 * never throws.
 */
export function normalizeLocation(raw: unknown): LocationData | undefined {
  const result = locationValueSchema.safeParse(raw);
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
    location: normalizeLocation(raw.location),
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
  /** Optional per-option explanation (canonical `oneOf` entries only). */
  description?: string;
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
        (
          entry,
        ): entry is {
          const: string | number;
          title: string;
          description?: string;
        } =>
          typeof entry === 'object' &&
          entry !== null &&
          'const' in entry &&
          (typeof (entry as Record<string, unknown>).const === 'string' ||
            typeof (entry as Record<string, unknown>).const === 'number') &&
          'title' in entry &&
          typeof (entry as Record<string, unknown>).title === 'string',
      )
      .map((entry) => ({
        value: entry.const,
        title: entry.title,
        ...(typeof entry.description === 'string'
          ? { description: entry.description }
          : {}),
      }));
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

const DISTRICT_CATEGORY_LABEL_PATTERN = /^district\s*\d+$/i;

/**
 * Matches boundary-derived "District N" category labels. These categories are
 * auto-assigned from the proposal's pin location (see `boundaryCategory.ts`),
 * not user-selected, so the proposal form hides them from the category
 * dropdown while keeping them in the schema so auto-filled values still
 * validate.
 */
export function isDistrictCategoryLabel(label: string): boolean {
  return DISTRICT_CATEGORY_LABEL_PATTERN.test(label.trim());
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

/**
 * Find the option in a JSON Schema property whose `value` matches the given
 * stored value. Stringifies both sides so callers don't have to worry about
 * `string` vs `number` consts in `oneOf`.
 */
export function findSchemaOption(
  schema: XFormatPropertySchema | null | undefined,
  value: unknown,
): SchemaOption | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const stringified = String(value);
  return parseSchemaOptions(schema).find(
    (option) => String(option.value) === stringified,
  );
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
