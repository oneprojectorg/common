import { schemaValidator } from './schemaValidator';
import { rubricReviewDataSchema } from './schemas/reviews';
import type { RubricTemplateSchema, XFormatPropertySchema } from './types';

/**
 * Possible values a single rubric answer can hold once parsed against the
 * template.
 *
 * The rubric template is loaded at runtime, so per-key static narrowing
 * isn't possible — `z.infer` only resolves when the schema is known at
 * compile time. The best static type we can give is the union of value
 * shapes that JSON Schema can express here. Per-key narrowing comes from
 * helpers (`readRubricNumber` / `readRubricString`) that take the criterion
 * key.
 */
export type RubricAnswerValue = number | string | null;

export interface ParsedRubricReviewData {
  answers: Record<string, RubricAnswerValue>;
  rationales: Record<string, string>;
}

/**
 * Validate a single rubric answer against its criterion's JSON Schema using
 * Ajv (via the shared `schemaValidator`). Centralised so the read path uses
 * the same validator — and the same vendor-extension keywords (`x-format`,
 * `x-field-order`) — that the write path goes through.
 */
function isAnswerValid(
  propSchema: XFormatPropertySchema,
  value: unknown,
): boolean {
  return schemaValidator.validate(propSchema, value).valid;
}

/**
 * Narrow an arbitrary stored answer to a `RubricAnswerValue`. Anything that
 * isn't a primitive JSON scalar is dropped — answers persisted as objects or
 * arrays don't fit any current rubric criterion shape and would only confuse
 * downstream consumers.
 */
function asAnswerValue(value: unknown): RubricAnswerValue | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return null;
  }
  return undefined;
}

/**
 * Parse persisted review data against the rubric template.
 *
 * Two passes:
 *   1. Wrapper — `{ answers, rationales }` via Zod (`rubricReviewDataSchema`).
 *      A wrapper-shape failure (legacy/malformed row) falls back to
 *      `{ answers: {}, rationales: {} }` so a single bad row never breaks
 *      an entire admin list.
 *   2. Per-criterion answers — each known key is validated against its JSON
 *      Schema property via Ajv. A failing key is dropped while siblings parse
 *      cleanly. Keys whose criterion was removed from the template are kept
 *      when the value is a primitive scalar.
 *
 * Static type stays a union (`RubricAnswerValue`) because the template is
 * dynamic. Use `readRubricNumber` / `readRubricString` when a caller wants
 * narrowed access for a specific criterion.
 */
export function parseRubricReviewData(
  template: RubricTemplateSchema | null | undefined,
  raw: unknown,
): ParsedRubricReviewData {
  const wrapper = rubricReviewDataSchema.safeParse(raw);
  const { answers: rawAnswers, rationales } = wrapper.success
    ? wrapper.data
    : { answers: {}, rationales: {} };

  const properties = template?.properties ?? {};
  const answers: Record<string, RubricAnswerValue> = {};

  for (const [key, value] of Object.entries(rawAnswers)) {
    const propSchema = properties[key];

    if (propSchema && !isAnswerValid(propSchema, value)) {
      continue;
    }

    const narrowed = asAnswerValue(value);
    if (narrowed === undefined) {
      continue;
    }
    answers[key] = narrowed;
  }

  return { answers, rationales };
}

/**
 * Read a numeric answer for a criterion. Returns `undefined` when the key is
 * absent or the stored value isn't a number — callers don't need to repeat
 * the `typeof value === 'number'` check.
 */
export function readRubricNumber(
  answers: Record<string, RubricAnswerValue>,
  key: string,
): number | undefined {
  const value = answers[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Read a string answer for a criterion. Returns `undefined` when the key is
 * absent or the stored value isn't a string.
 */
export function readRubricString(
  answers: Record<string, RubricAnswerValue>,
  key: string,
): string | undefined {
  const value = answers[key];
  return typeof value === 'string' ? value : undefined;
}
