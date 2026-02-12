/**
 * Canonical field-ordering utility for proposal templates.
 *
 * Given a proposal template schema, returns the field keys partitioned into
 * system fields and user-defined ("rest") fields, respecting `x-field-order`
 * for ordering and falling back to `Object.keys(properties)` for any keys
 * not listed in the order array.
 *
 * This is the single source of truth for "what order do template fields
 * appear in?" — prefer this over hand-rolling the ordering logic.
 */

/**
 * System property keys that receive special treatment in the proposal UI.
 * Their data definition comes from the template; only the rendering is
 * overridden.
 */
export const SYSTEM_FIELD_KEYS = new Set(['title', 'budget', 'category']);

export interface ProposalTemplateFieldOrder {
  /** System fields (title, budget, category) in canonical order. */
  system: string[];
  /** User-defined fields in template order (x-field-order + remainder). */
  rest: string[];
  /** All fields: system first, then rest. */
  all: string[];
}

/**
 * Derives the ordered field keys from a proposal template, partitioned by
 * system vs user-defined fields.
 *
 * Ordering rules:
 * 1. System fields come first, in the order they appear in `SYSTEM_FIELD_KEYS`,
 *    but only if the template actually defines them in `properties`.
 * 2. User-defined fields follow, ordered by `x-field-order` first, then any
 *    remaining `properties` keys not covered by the order array.
 * 3. Duplicates are suppressed — each key appears at most once.
 *
 * @param proposalTemplate - The proposal template schema (JSON Schema with
 *   `x-field-order` vendor extension).
 */
export function getProposalTemplateFieldOrder(
  proposalTemplate: Record<string, unknown>,
): ProposalTemplateFieldOrder {
  const empty: ProposalTemplateFieldOrder = {
    system: [],
    rest: [],
    all: [],
  };

  const properties = proposalTemplate.properties as
    | Record<string, unknown>
    | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return empty;
  }

  const fieldOrder =
    (proposalTemplate['x-field-order'] as string[] | undefined) ?? [];

  const seen = new Set<string>();
  const system: string[] = [];
  const rest: string[] = [];

  // --- System fields first, in SYSTEM_FIELD_KEYS iteration order -----------
  for (const key of SYSTEM_FIELD_KEYS) {
    if (seen.has(key) || !properties[key]) {
      continue;
    }
    seen.add(key);
    system.push(key);
  }

  // --- User-defined fields: x-field-order, then remainder ------------------
  const orderedKeys = [
    ...fieldOrder,
    ...Object.keys(properties).filter((k) => !fieldOrder.includes(k)),
  ];

  for (const key of orderedKeys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    if (!properties[key]) {
      continue;
    }

    rest.push(key);
  }

  return {
    system,
    rest,
    all: [...system, ...rest],
  };
}
