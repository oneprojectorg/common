/**
 * Which template criteria can be filtered on, and with what options.
 *
 * A criterion is filterable only when its stored answer is an option id (or a
 * list of them): those are the shapes a `@>` containment predicate can match
 * and the GIN index on the answers column can serve. Free text, scores and
 * money answers are not option ids, so they are left out here rather than
 * filtered badly later.
 *
 * This deliberately re-derives the classification instead of importing the
 * builder's `inferCriterionType`: that one lives in `apps/app` and answers a
 * renderer's question (which widget), while this one answers a query
 * planner's (which containment shape). Keeping them apart lets the renderer
 * grow widget types without changing what is indexable.
 *
 * Template-shape only — no database or request context — so the same code
 * serves a rubric's `review_data -> 'answers'` and, later, a proposal
 * template's `proposal_data`.
 */
import type { JSONSchema7 } from 'json-schema';

import { isMoneyFieldSchema } from '../decision/rubric/money';
import type { XFormatPropertySchema } from '../decision/types';

/** How a criterion's answer is stored: one option id, or an array of them. */
export type ChoiceKind = 'single' | 'multi';

/** A filterable criterion plus the option catalogue its answers draw from. */
export interface ChoiceCriterion {
  /** Property key in the template — also the key inside the answers object. */
  key: string;
  kind: ChoiceKind;
  /** Option ids in template order. Facets report a count for every one. */
  optionIds: string[];
}

/** The subset of a JSON Schema template this module reads. */
export interface ChoiceTemplate {
  properties?: Record<string, XFormatPropertySchema>;
  'x-field-order'?: string[];
}

/**
 * Every filterable criterion in `template`, in the order the template
 * presents them (`x-field-order` first, then any property it forgot).
 */
export function extractChoiceCriteria(
  template: ChoiceTemplate | null | undefined,
): ChoiceCriterion[] {
  const properties = template?.properties;
  if (!properties) {
    return [];
  }

  const criteria: ChoiceCriterion[] = [];
  for (const key of orderedPropertyKeys(template)) {
    const schema = properties[key];
    if (!schema) {
      continue;
    }
    const criterion = classifyChoiceCriterion(key, schema);
    if (criterion) {
      criteria.push(criterion);
    }
  }

  return criteria;
}

/** Index the criteria by key so a filter payload can be validated per key. */
export function indexChoiceCriteria(
  criteria: readonly ChoiceCriterion[],
): Map<string, ChoiceCriterion> {
  return new Map(criteria.map((criterion) => [criterion.key, criterion]));
}

/**
 * `undefined` when the criterion's answer is not an option id.
 *
 * Shape-driven, with one declared exception: a money field is `type: 'object'`
 * and could never match anyway, but it is excluded up front to keep the rule
 * "money is declared, never inferred" true on both sides of the codebase.
 */
function classifyChoiceCriterion(
  key: string,
  schema: XFormatPropertySchema,
): ChoiceCriterion | undefined {
  if (isMoneyFieldSchema(schema)) {
    return undefined;
  }

  const types = declaredTypes(schema);

  // `array` carries its options on `items` — the "check all that apply"
  // criterion, stored as an array of option ids. Checked first: a nullable
  // multi choice declares both `array` and `null`, and the array half is what
  // decides the containment shape.
  if (types.includes('array')) {
    const items = schema.items;
    if (typeof items !== 'object' || items === null || Array.isArray(items)) {
      return undefined;
    }
    const optionIds = stringConsts(items);
    return optionIds.length > 0 ? { key, kind: 'multi', optionIds } : undefined;
  }

  // `string` with string options is a single choice. This is the shape of a
  // yes/no criterion, of a multiple-choice criterion, and of
  // `__overall_recommendation` — all three filter identically, so none of
  // them is special-cased.
  if (types.includes('string')) {
    const optionIds = stringConsts(schema);
    return optionIds.length > 0
      ? { key, kind: 'single', optionIds }
      : undefined;
  }

  return undefined;
}

/**
 * A property's declared JSON Schema types, always as a list.
 *
 * `type` is legally either a name or a union of names, and real templates use
 * both: a nullable dropdown is authored as `type: ['string', 'null']`. Reading
 * `type === 'string'` alone silently drops every nullable choice field.
 */
function declaredTypes(schema: JSONSchema7): string[] {
  const type = schema.type;
  if (typeof type === 'string') {
    return [type];
  }
  return Array.isArray(type) ? type : [];
}

/**
 * The `oneOf` option ids of a sub-schema. Only string `const`s: a scored
 * criterion's options are integers, and an integer answer is not an id.
 */
function stringConsts(schema: JSONSchema7): string[] {
  const oneOf = schema.oneOf;
  if (!Array.isArray(oneOf)) {
    return [];
  }

  const ids: string[] = [];
  for (const entry of oneOf) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    if (typeof entry.const === 'string') {
      ids.push(entry.const);
    }
  }
  // De-duplicate so a malformed template cannot produce two facet buckets
  // for one option.
  return [...new Set(ids)];
}

/** `x-field-order` first, then properties it does not mention. */
function orderedPropertyKeys(template: ChoiceTemplate): string[] {
  const properties = template.properties ?? {};
  const declared = template['x-field-order'] ?? [];
  const seen = new Set<string>();
  const keys: string[] = [];

  for (const key of declared) {
    if (key in properties && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  for (const key of Object.keys(properties)) {
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}
