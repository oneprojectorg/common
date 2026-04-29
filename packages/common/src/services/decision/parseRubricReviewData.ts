import { z } from 'zod';

import { schemaValidator } from './schemaValidator';
import { rubricReviewDataSchema } from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

/**
 * Possible values a single rubric answer can hold once parsed. The rubric
 * template is loaded at runtime so per-key static narrowing isn't possible
 * via `z.infer` — the union is the strongest static type. Per-criterion
 * narrowing comes from inline `typeof` checks in callers.
 */
export type RubricAnswerValue = number | string | null;

const rubricAnswerValueSchema: z.ZodType<RubricAnswerValue> = z.union([
  z.number(),
  z.string(),
  z.null(),
]);

const rubricAnswersSchema = z.record(z.string(), rubricAnswerValueSchema);

export interface ParsedRubricReviewData {
  answers: Record<string, RubricAnswerValue>;
  rationales: Record<string, string>;
}

/**
 * Read-path entry for review data — the rubric counterpart to
 * `parseProposalData`. Three steps:
 *   1. Zod parses the wrapper shape (`{ answers, rationales }`).
 *   2. Ajv validates the answer payload against the rubric template — same
 *      validator the write path uses (`schemaValidator.assertRubricData`).
 *   3. Zod narrows the answer values from `unknown` to `RubricAnswerValue`,
 *      so callers don't have to cast.
 *
 * Tolerant on every step: a wrapper-shape failure or an Ajv mismatch returns
 * empty answers (rationales preserved when available) so a single legacy
 * row can't break an admin list. Errors that need surfacing happen at the
 * write path; reads stay defensive.
 */
export function parseRubricReviewData(
  template: RubricTemplateSchema | null | undefined,
  raw: unknown,
): ParsedRubricReviewData {
  const wrapper = rubricReviewDataSchema.safeParse(raw);
  if (!wrapper.success) {
    return { answers: {}, rationales: {} };
  }

  const { answers: rawAnswers, rationales } = wrapper.data;

  if (template && !schemaValidator.validate(template, rawAnswers).valid) {
    return { answers: {}, rationales };
  }

  const narrowed = rubricAnswersSchema.safeParse(rawAnswers);
  return {
    answers: narrowed.success ? narrowed.data : {},
    rationales,
  };
}
