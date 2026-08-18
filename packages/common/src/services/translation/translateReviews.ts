import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';

import { getProposalWithReviewAggregates } from '../decision/getProposalWithReviewAggregates';
import { getFreeTextCriterionKeys } from '../decision/rubricTranslatableCopy';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/** One reviewer's prose, keyed the way the renderer reads it. */
export interface ReviewTranslation {
  /** "Feedback to Author", when the reviewer wrote one. */
  overallComment?: string;
  /** Per-criterion notes, keyed by criterion id. */
  rationales: Record<string, string>;
  /** Free-text answers, keyed by criterion id. */
  answers: Record<string, string>;
}

const OVERALL_COMMENT_KEY = 'overall_comment';
const RATIONALE_PREFIX = 'rationale:';
const ANSWER_PREFIX = 'answer:';

/**
 * Translates what the reviewers wrote about a proposal in one phase — each
 * criterion's note, each free-text answer, and the feedback to the author.
 *
 * The rubric translation moves the *questions*; this moves the *answers*. A
 * screen that offered only the first left an admin reading a translated rubric
 * beside reviews still in the language they were written in, which is the half
 * of the page that carries the actual judgement.
 *
 * Addressed exactly like `getProposalWithReviewAggregates`, and gated by it: the
 * reviews reachable for translation are the ones that read on screen, never
 * more. Keyed by review id, so a caller can merge the results of several phases
 * into one map without collisions.
 *
 * Dropdown answers are deliberately absent: they store an option id, and their
 * labels travel with the rubric (see `buildRubricEntries`).
 */
export async function translateReviews({
  processInstanceId,
  proposalId,
  phaseId,
  targetLocale,
  user,
}: {
  processInstanceId: string;
  proposalId: string;
  phaseId?: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translations: Record<string, ReviewTranslation>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  const { reviews, rubricTemplate } = await getProposalWithReviewAggregates({
    processInstanceId,
    proposalId,
    phaseId,
    user,
  });

  const entries = buildReviewEntries(
    reviews,
    getFreeTextCriterionKeys(rubricTemplate),
  );

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const translations: Record<string, ReviewTranslation> = {};
  let sourceLocale = '';

  for (const result of results) {
    const parsed = parseReviewContentKey(result.contentKey);
    if (!parsed) {
      continue;
    }

    const translation = (translations[parsed.reviewId] ??= {
      rationales: {},
      answers: {},
    });

    if (parsed.fieldKey === OVERALL_COMMENT_KEY) {
      translation.overallComment = result.translatedText;
    } else if (parsed.fieldKey.startsWith(RATIONALE_PREFIX)) {
      translation.rationales[parsed.fieldKey.slice(RATIONALE_PREFIX.length)] =
        result.translatedText;
    } else if (parsed.fieldKey.startsWith(ANSWER_PREFIX)) {
      translation.answers[parsed.fieldKey.slice(ANSWER_PREFIX.length)] =
        result.translatedText;
    }

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translations, sourceLocale, targetLocale };
}

/**
 * Every piece of reviewer prose across these reviews, keyed by review id and
 * field so `parseReviewContentKey` can put the translations back.
 *
 * Blank text is skipped rather than sent: an empty note is not something to pay
 * a provider for, and an empty result would overwrite nothing usefully.
 */
function buildReviewEntries(
  reviews: Awaited<
    ReturnType<typeof getProposalWithReviewAggregates>
  >['reviews'],
  freeTextKeys: string[],
): TranslatableEntry[] {
  const entries: TranslatableEntry[] = [];

  for (const { review } of reviews) {
    const prefix = `review:${review.id}:`;

    if (review.overallComment?.trim()) {
      entries.push({
        contentKey: `${prefix}${OVERALL_COMMENT_KEY}`,
        text: review.overallComment,
      });
    }

    for (const [criterionKey, rationale] of Object.entries(
      review.reviewData.rationales,
    )) {
      if (rationale.trim()) {
        entries.push({
          contentKey: `${prefix}${RATIONALE_PREFIX}${criterionKey}`,
          text: rationale,
        });
      }
    }

    for (const criterionKey of freeTextKeys) {
      const answer = review.reviewData.answers[criterionKey];
      if (typeof answer === 'string' && answer.trim()) {
        entries.push({
          contentKey: `${prefix}${ANSWER_PREFIX}${criterionKey}`,
          text: answer,
        });
      }
    }
  }

  return entries;
}

/** `review:<uuid>:<fieldKey>` — the field key may itself contain colons. */
function parseReviewContentKey(
  contentKey: string,
): { reviewId: string; fieldKey: string } | null {
  const [scope, reviewId, ...rest] = contentKey.split(':');

  if (scope !== 'review' || !reviewId || rest.length === 0) {
    return null;
  }

  return { reviewId, fieldKey: rest.join(':') };
}
