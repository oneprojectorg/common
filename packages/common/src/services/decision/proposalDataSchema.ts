import { z } from 'zod';

import { type MoneyAmount, moneyAmountSchema } from '../../money';
import type { XFormatPropertySchema } from './types';

/**
 * Cap on a proposal title, in characters.
 *
 * The hard ceiling is the database: a proposal's title is its profile's name,
 * and `profiles.name` is `varchar(256)` — past that the insert throws. 200
 * keeps a margin under it and is a sane length for something rendered in
 * cards, list rows, and OG images. A template may ask for less; it may not ask
 * for more.
 *
 * (`extractProposalConfig` also names 200, but nothing reads the config it
 * builds, so that value enforces nothing.)
 */
export const PROPOSAL_TITLE_MAX_LENGTH = 200;

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
 * Canonical budget shape — an alias for `MoneyAmount`.
 * @deprecated Prefer `MoneyAmount` for new code.
 */
export type BudgetData = MoneyAmount;

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
 * Normalize a raw location value into `LocationData` using
 * `locationValueSchema`. Returns `undefined` for absent or malformed values —
 * never throws.
 */
export function normalizeLocation(raw: unknown): LocationData | undefined {
  const result = locationValueSchema.safeParse(raw);
  return result.success ? (result.data ?? undefined) : undefined;
}

/**
 * The canonical point for a location: the geocoded place when one was
 * resolved, falling back to the submitted pin.
 *
 * `placeLat`/`placeLng` are optional because the picker only sets them when
 * the geocoder returns a match — a pin in open water, or anywhere the lookup
 * misses, yields a perfectly valid location carrying nothing but `lat`/`lng`.
 * Anything needing one authoritative coordinate per proposal (deduplicating
 * co-located proposals, plotting on a map, exporting for GIS) wants this
 * rather than the raw `place*` fields, which would drop those proposals.
 */
export function getPlaceCoordinates(location: LocationData): {
  lat: number;
  lng: number;
} {
  return {
    lat: location.placeLat ?? location.lat,
    lng: location.placeLng ?? location.lng,
  };
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

/**
 * The subset of {@link parseSchemaOptions} whose labels a translation may
 * replace: `oneOf` entries (top-level or under `items`) that store a `title`
 * apart from the answer value.
 *
 * A legacy `enum` option has no separate label — the label *is* the value every
 * stored answer holds — so translating it would rewrite answers rather than
 * copy. Excluded here so the sender and the renderer agree on what can move:
 * anything collected for translation can be swapped back in, and anything else
 * reads as authored.
 */
export function parseTranslatableSchemaOptions(
  schema: XFormatPropertySchema | null | undefined,
): SchemaOption[] {
  if (!schema) {
    return [];
  }

  const itemSchema =
    typeof schema.items === 'object' &&
    schema.items !== null &&
    !Array.isArray(schema.items)
      ? schema.items
      : undefined;

  if (!Array.isArray(schema.oneOf) && !Array.isArray(itemSchema?.oneOf)) {
    return [];
  }

  return parseSchemaOptions(schema);
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
