import type { RubricTemplateSchema, XFormat } from './types';

/** Scoring info for a single rubric criterion. */
export interface RubricCriterion {
  key: string;
  /** `schema.maximum` for scored criteria, 0 otherwise. */
  maxPoints: number;
  /** `true` when `type === 'integer'` — i.e. the field contributes points. */
  scored: boolean;
}

/** Derived scoring metadata for a rubric template schema. */
export interface RubricScoringInfo {
  criteria: RubricCriterion[];
  /** Sum of `maxPoints` across scored criteria. */
  totalPoints: number;
  /** Count of criteria per `x-format` value. */
  summary: Partial<Record<XFormat, number>>;
}

/**
 * Derives scoring info from a rubric template schema.
 *
 * **Scoring rule (MVP):** `type: "integer"` = scored, points = `maximum`.
 * Everything else is qualitative (0 pts).
 *
 * Used by both frontend (footer summary, preview pts labels) and backend
 * (score aggregation later).
 */
export function getRubricScoringInfo(
  schema: RubricTemplateSchema,
): RubricScoringInfo {
  const properties = schema.properties ?? {};

  const criteria: RubricCriterion[] = [];
  const summary: Partial<Record<XFormat, number>> = {};
  let totalPoints = 0;

  for (const [key, prop] of Object.entries(properties)) {
    const scored = prop.type === 'integer';
    const maxPoints = scored
      ? typeof prop.maximum === 'number'
        ? prop.maximum
        : 0
      : 0;

    criteria.push({
      key,
      maxPoints,
      scored,
    });

    totalPoints += maxPoints;

    const xFormat = prop['x-format'];
    if (xFormat) {
      summary[xFormat] = (summary[xFormat] ?? 0) + 1;
    }
  }

  return { criteria, totalPoints, summary };
}
