import { compileRubricSchema } from './compileRubricSchema';
import { isOverallRecommendationField } from './getRubricScoringInfo';
import {
  getCriterionMaxPoints,
  inferCriterionType,
} from './inferCriterionType';
import { findSchemaOption } from './proposalDataSchema';
import type { ProposalReview } from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

/**
 * The labels {@link resolveSubmittedReview} needs translated. `t` is injected
 * because the resolver is pure and runs outside React (e.g. in a background
 * Inngest function); the app passes its `useTranslations()` `t`, background
 * senders pass an identity function.
 */
export type ResolveSubmittedReviewTranslator = (
  key: 'Yes' | 'No' | 'Feedback to Author',
) => string;

export type ResolvedReviewAnswerType =
  | 'yes_no'
  | 'overall_recommendation'
  | 'single_select'
  | 'scored'
  | 'dropdown'
  | 'text'
  | 'unsupported';

/**
 * One normalised, human-readable row per rubric criterion. Semantic fields,
 * not presentation slots — consumers map them onto their own layout.
 */
export interface ResolvedReviewAnswer {
  /** Property key in the rubric template. */
  key: string;
  /** Criterion label from the template. */
  title?: string;
  /** Criterion guidance text from the template. */
  description?: string;
  /** Whether the criterion is required by the template. */
  required?: boolean;
  type: ResolvedReviewAnswerType;
  /** The answer as readable text (option title, Yes/No, score, …). */
  valueLabel?: string;
  /**
   * Explanation of the chosen value: the option description on
   * `single_select` criteria, the score label on scored dropdowns, or the
   * answer text itself on `text` criteria.
   */
  valueDescription?: string;
  /** Maximum points. Set for scored criteria only. */
  maxPoints?: number;
  /** The reviewer's free-text rationale for this criterion, if any. */
  rationale?: string;
}

export interface ResolvedSubmittedReview {
  answers: ResolvedReviewAnswer[];
  /** The reviewer's overall comment with its translated section title. */
  overallComment: { title: string; comment: string } | null;
}

/**
 * Resolve a submitted review's raw `reviewData` against its rubric template
 * into readable rows. Raw answers are not display-ready: a `single_select`
 * value is an opaque option id, a `yes_no` value is the literal `'yes'`, and
 * scored answers need their score label and max points looked up.
 */
export function resolveSubmittedReview(
  template: RubricTemplateSchema,
  review: ProposalReview,
  { t }: { t: ResolveSubmittedReviewTranslator },
): ResolvedSubmittedReview {
  const fields = compileRubricSchema(template);
  const { answers, rationales } = review.reviewData;

  const rows = fields.map((field): ResolvedReviewAnswer => {
    const value = answers[field.key];
    const rationale = rationales[field.key]?.trim() || undefined;
    const base = {
      key: field.key,
      title: field.schema.title,
      description: field.schema.description,
      required: field.required,
    };

    if (field.format === 'dropdown') {
      const criterionType = inferCriterionType(field.schema);

      if (criterionType === 'yes_no') {
        const valueLabel =
          value === 'yes' ? t('Yes') : value === 'no' ? t('No') : undefined;
        return { ...base, type: 'yes_no', valueLabel, rationale };
      }

      const selected = findSchemaOption(field.schema, value);

      if (isOverallRecommendationField(field.key)) {
        return {
          ...base,
          type: 'overall_recommendation',
          valueLabel:
            selected?.title ?? (selected ? String(selected.value) : undefined),
          rationale,
        };
      }

      // Single-select options store an opaque id as the value, so resolve
      // the option's title (and surface its description) instead.
      if (criterionType === 'single_select') {
        return {
          ...base,
          type: 'single_select',
          valueLabel: selected ? selected.title || String(selected.value) : '—',
          valueDescription: selected?.description || undefined,
          rationale,
        };
      }

      // Scored (and any other) dropdowns: the stored value is the answer;
      // the option title is its label (e.g. the score-level description).
      return {
        ...base,
        type: criterionType === 'scored' ? 'scored' : 'dropdown',
        valueLabel: selected ? String(selected.value) : undefined,
        valueDescription: selected?.title || undefined,
        maxPoints: getCriterionMaxPoints(template, field.key),
        rationale,
      };
    }

    if (field.format === 'long-text' || field.format === 'short-text') {
      const text = typeof value === 'string' ? value.trim() : '';
      return { ...base, type: 'text', valueDescription: text || '—' };
    }

    return { ...base, type: 'unsupported' };
  });

  return {
    answers: rows,
    overallComment: review.overallComment
      ? { title: t('Feedback to Author'), comment: review.overallComment }
      : null,
  };
}
