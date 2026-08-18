import { OVERALL_RECOMMENDATION_KEY } from './getRubricScoringInfo';
import {
  type SchemaOption,
  parseTranslatableSchemaOptions,
} from './proposalDataSchema';
import type { RubricTemplateSchema, XFormatPropertySchema } from './types';

/** One criterion's authored copy: what a translation may move. */
export interface TranslatableRubricCriterion {
  criterionKey: string;
  title?: string;
  description?: string;
  /** Options whose label is stored apart from the answer value. */
  options: SchemaOption[];
}

/**
 * The copy in a rubric that a reviewer's admin actually wrote — the only copy
 * worth sending to a translation provider, and the only copy that should raise
 * the "Translate to X" banner.
 *
 * Three kinds of text live in a rubric schema and only the first is authored:
 *
 * 1. Criterion prompts, descriptions, and admin-written option labels. Authored,
 *    so translatable.
 * 2. The overall-recommendation criterion. `enableOverallRecommendation` writes
 *    its prompt and its Yes/Maybe/No labels into the schema in English and no
 *    builder screen can edit them, so the UI reads them from the dictionary
 *    instead (see `useRecommendationLabels`). Sending them would pay for copy
 *    the screen never shows, and — worse — the stored English made an
 *    all-Spanish rubric look foreign to a Spanish reader.
 * 3. A yes/no criterion's `Yes`/`No` option labels, written by
 *    `createCriterionJsonSchema` for the same reason and rendered the same way.
 *    Its prompt and description *are* authored, so those stay.
 *
 * Shared by the sender (`buildRubricEntries`) and the detector
 * (`getRubricDetectionText`) so a rubric never offers a translation it cannot
 * produce, or produces copy no screen reads.
 */
export function getTranslatableRubricCopy(
  rubricTemplate: RubricTemplateSchema | null | undefined,
): TranslatableRubricCriterion[] {
  const criteria: TranslatableRubricCriterion[] = [];

  for (const [criterionKey, property] of Object.entries(
    rubricTemplate?.properties ?? {},
  )) {
    if (criterionKey === OVERALL_RECOMMENDATION_KEY) {
      continue;
    }

    criteria.push({
      criterionKey,
      ...(property.title ? { title: property.title } : {}),
      ...(property.description ? { description: property.description } : {}),
      options: isYesNoCriterionSchema(property)
        ? []
        : parseTranslatableSchemaOptions(property),
    });
  }

  return criteria;
}

/** Criterion formats whose stored answer is prose the reviewer typed. */
const FREE_TEXT_FORMATS = new Set(['long-text', 'short-text']);

/**
 * Criteria whose answers are the reviewer's own words rather than an option id.
 *
 * Both halves of the review-prose path read this: the sender translates these
 * answers, and language detection samples them. Sampling a dropdown answer
 * instead would feed an opaque option id (`a1b2c3d4`) to the language detector.
 */
export function getFreeTextCriterionKeys(
  rubricTemplate: RubricTemplateSchema | null | undefined,
): string[] {
  return Object.entries(rubricTemplate?.properties ?? {})
    .filter(([, property]) => FREE_TEXT_FORMATS.has(property['x-format'] ?? ''))
    .map(([criterionKey]) => criterionKey);
}

/**
 * True for the builder's "yes/no" criterion — a string dropdown whose two
 * options are exactly `yes` and `no`.
 *
 * Reads `oneOf` only, so a legacy `enum`-encoded field is not one: its labels
 * are its stored answers, which nothing may rewrite.
 */
export function isYesNoCriterionSchema(
  schema: XFormatPropertySchema | null | undefined,
): boolean {
  if (
    !schema ||
    schema['x-format'] !== 'dropdown' ||
    schema.type !== 'string' ||
    !Array.isArray(schema.oneOf)
  ) {
    return false;
  }

  const values = schema.oneOf.map((entry) =>
    typeof entry === 'object' && entry !== null ? entry.const : undefined,
  );

  return values.length === 2 && values.includes('yes') && values.includes('no');
}
