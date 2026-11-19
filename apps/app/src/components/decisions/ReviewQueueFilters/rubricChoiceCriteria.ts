/**
 * The choice criteria of a phase rubric, flattened for the review queue's
 * filter sheet: one section per criterion whose answer is an option id (or a
 * list of them).
 *
 * Those are the only criteria a containment filter and a facet count can be
 * built from — free text, scores and money answers are left out rather than
 * filtered badly. The overall recommendation is kept, which is why this does
 * not reuse `getCriteria`: that reader drops it, and it is the criterion
 * reviewers most want to filter by.
 *
 * The option catalogue is read straight off the template rather than through
 * `getCriterionOptions`, which resolves options only for the criterion types
 * the builder offers — a yes/no criterion is a choice criterion here but has
 * no builder options.
 */
import type {
  RubricTemplateSchema,
  XFormatPropertySchema,
} from '@op/common/client';
import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';

import {
  getCriterionLabel,
  getCriterionOrder,
  getCriterionSchema,
  inferCriterionType,
} from '../rubricTemplate';

/** How an answer is stored: one option id, or an array of them. */
export type ChoiceKind = 'single' | 'multi';

export interface ChoiceOption {
  /** The stored answer value — also the facet's option id. */
  id: string;
  label: string;
}

/** One filterable criterion plus its options, in rubric order. */
export interface ChoiceCriterionView {
  key: string;
  kind: ChoiceKind;
  /** The criterion's own prompt — admin-authored content, not UI copy. */
  title: string;
  options: ChoiceOption[];
}

/**
 * Every choice criterion in `template`, ordered as the rubric presents them.
 * Empty for a phase with no rubric, which is how the sheet knows to stay
 * hidden.
 */
export function extractChoiceCriteria(
  template: RubricTemplateSchema | null | undefined,
): ChoiceCriterionView[] {
  if (!template) {
    return [];
  }

  const criteria: ChoiceCriterionView[] = [];
  for (const key of getCriterionOrder(template)) {
    const schema = getCriterionSchema(template, key);
    if (!schema) {
      continue;
    }
    const kind = choiceKind(schema);
    if (!kind) {
      continue;
    }
    const options = readOptions(optionCarrier(schema));
    if (options.length === 0) {
      continue;
    }
    criteria.push({
      key,
      kind,
      title: getCriterionLabel(template, key) || key,
      options,
    });
  }

  return criteria;
}

/**
 * How the criterion's answer is stored, or `undefined` when it is not an
 * option id at all.
 *
 * `inferCriterionType` answers first, so the sheet and the review form agree
 * on what a criterion is (with `yes_no` folded in — it stores a single option
 * id like any other single choice). It reads `type` as a scalar, though, and a
 * rubric can declare a union like `["string", "null"]`; such a criterion falls
 * through to the option-shape check below rather than vanishing from the
 * sheet. Erring wide is the safe direction: a section the filter API ignores
 * only widens the result set, while a missing section hides a filter.
 */
function choiceKind(schema: XFormatPropertySchema): ChoiceKind | undefined {
  switch (inferCriterionType(schema)) {
    case 'multi_select':
      return 'multi';
    case 'single_select':
    case 'yes_no':
      return 'single';
    default:
      break;
  }

  return declaresType(schema, 'array') ? 'multi' : 'single';
}

/** True when `type` is `name`, or a union containing it. */
function declaresType(schema: JSONSchema7, name: JSONSchema7TypeName): boolean {
  const type = schema.type;
  return Array.isArray(type) ? type.includes(name) : type === name;
}

/**
 * Where a criterion's `oneOf` lives: on the property itself, or on `items`
 * when the answer is an array of ids ("check all that apply").
 */
function optionCarrier(schema: XFormatPropertySchema): JSONSchema7 {
  const items = schema.items;
  if (
    declaresType(schema, 'array') &&
    typeof items === 'object' &&
    items !== null &&
    !Array.isArray(items)
  ) {
    return items;
  }
  return schema;
}

/**
 * The `oneOf` options of a sub-schema. String `const`s only — a scored
 * criterion's options are integers, and an integer answer is not an option id.
 * De-duplicated so a malformed template cannot render one option twice.
 */
function readOptions(schema: JSONSchema7): ChoiceOption[] {
  const oneOf = schema.oneOf;
  if (!Array.isArray(oneOf)) {
    return [];
  }

  const byId = new Map<string, ChoiceOption>();
  for (const entry of oneOf) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    if (typeof entry.const !== 'string' || byId.has(entry.const)) {
      continue;
    }
    byId.set(entry.const, {
      id: entry.const,
      label:
        typeof entry.title === 'string' && entry.title.trim().length > 0
          ? entry.title
          : entry.const,
    });
  }

  return [...byId.values()];
}
