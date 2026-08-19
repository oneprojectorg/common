import {
  type Proposal,
  type ProposalTemplateSchema,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  getFreeTextCriterionKeys,
  getTranslatableRubricCopy,
  serverExtensions,
} from '@op/common/client';
import { getTextPreview } from '@op/core';
import { type JSONContent, generateText } from '@tiptap/core';

import {
  getProposalContentPreview,
  resolveProposalSystemFields,
} from './proposalContentUtils';

/** Cap the sample fed to language detection — a few hundred chars already suffices. */
const MAX_SAMPLE_LENGTH = 2000;

/** The proposal fields language detection reads. */
type ProposalTextSource = Pick<
  Proposal,
  | 'previewText'
  | 'documentContent'
  | 'proposalTemplate'
  | 'htmlContent'
  | 'proposalData'
  | 'profile'
>;

const htmlToText = (html: string): string =>
  getTextPreview({ content: html, maxLines: 20, maxLength: MAX_SAMPLE_LENGTH });

/** Joins sample parts, dropping empties, and caps the result. */
const joinSample = (parts: string[]): string =>
  parts.filter(Boolean).join('\n').slice(0, MAX_SAMPLE_LENGTH);

/**
 * Plain-text sample of a proposal (title + body), for language detection.
 *
 * The title always leads the sample: list reads ship no document fragments and
 * `previewText` is empty for a proposal with a short or empty body, so the title
 * is often the only text there is. Without it those proposals detected as
 * "nothing to translate" and the list never offered the banner at all.
 *
 * For the body, prefers the server-computed `previewText` (list payloads), then
 * `documentContent` (single-proposal payloads, what the cards render from), and
 * finally the rendered `htmlContent` when the collaboration document isn't
 * available yet.
 */
export const getProposalDetectionText = (
  proposal: ProposalTextSource,
): string => {
  // Same resolution the card and the header use, so detection samples exactly
  // the title the reader sees.
  const { title } = resolveProposalSystemFields(proposal);
  const parts = [title?.trim() || proposal.profile?.name?.trim() || ''];

  parts.push(getProposalBodyText(proposal));

  return joinSample(parts);
};

/** Body-only sample; the title is prepended by {@link getProposalDetectionText}. */
const getProposalBodyText = (proposal: ProposalTextSource): string => {
  // List payloads carry the server-computed preview (already capped) —
  // prefer it so no client-side fragment walk is needed.
  const fromPreview = proposal.previewText?.trim() ?? '';
  if (fromPreview) {
    return fromPreview;
  }

  const template =
    (proposal.proposalTemplate as ProposalTemplateSchema | null) ?? undefined;
  const fromDocument =
    getProposalContentPreview(proposal.documentContent, template)?.trim() ?? '';
  if (fromDocument) {
    return fromDocument;
  }

  return Object.values(proposal.htmlContent ?? {})
    .filter((value): value is string => typeof value === 'string')
    .map(htmlToText)
    .join('\n')
    .trim();
};

/**
 * Plain-text sample of a rubric — every criterion's prompt and description, and
 * each option's label and description. The reviewer reads this alongside the
 * proposal, so a foreign-language rubric has to offer translation even when the
 * proposal itself is already in the reader's language.
 *
 * Reads the same authored copy `buildRubricEntries` sends, through the shared
 * `getTranslatableRubricCopy`: copy the banner can move has to be able to raise
 * it (a rubric whose only foreign text sat in an option description used to read
 * as "nothing to translate"), and copy it cannot move must not raise it (our own
 * English Yes/No labels used to make an all-Spanish rubric look foreign).
 */
export const getRubricDetectionText = (
  rubricTemplate: RubricTemplateSchema | null | undefined,
): string => {
  const parts: string[] = [];

  for (const criterion of getTranslatableRubricCopy(rubricTemplate)) {
    if (criterion.title) {
      parts.push(criterion.title);
    }
    if (criterion.description) {
      parts.push(criterion.description);
    }
    for (const option of criterion.options) {
      if (option.title) {
        parts.push(option.title);
      }
      if (option.description) {
        parts.push(option.description);
      }
    }
  }

  return joinSample(parts);
};

/**
 * Plain-text sample of what reviewers wrote about a proposal — each criterion
 * note, each free-text answer, and the feedback to the author.
 *
 * Its own sample rather than part of the rubric's: the reviews carry the
 * judgement an admin reads the summary for, and they are routinely in a
 * different language from both the rubric and the proposal. Dropdown answers are
 * option ids, not prose, so they contribute nothing.
 */
export const getReviewsDetectionText = (
  reviews: readonly SubmittedReviewItem[],
  rubricTemplate: RubricTemplateSchema | null | undefined,
): string => {
  const freeTextKeys = getFreeTextCriterionKeys(rubricTemplate);
  const parts: string[] = [];

  for (const { review } of reviews) {
    if (review.overallComment) {
      parts.push(review.overallComment);
    }
    parts.push(...Object.values(review.reviewData.rationales));
    for (const criterionKey of freeTextKeys) {
      const answer = review.reviewData.answers[criterionKey];
      if (typeof answer === 'string') {
        parts.push(answer);
      }
    }
  }

  return joinSample(parts.map((part) => part.trim()));
};

/**
 * Detection samples for a phase's authored hero copy.
 *
 * `additionalInfo` is included because `translateDecision` moves it and the
 * phase pages render it in the "About this phase" bar — a phase whose only
 * foreign copy lived there hid the control while a click would have translated
 * it.
 *
 * Returned as separate samples rather than one joined string so each is judged
 * on its own; a short foreign headline is not drowned out by a long English
 * description.
 */
export const getPhaseDetectionSamples = (
  phase:
    | {
        headline?: string | null;
        description?: string | null;
        additionalInfo?: string | null;
      }
    | null
    | undefined,
): string[] => [
  phase?.headline ?? '',
  phase?.description ?? '',
  phase?.additionalInfo ?? '',
];

/** Detection samples for a list of resources (each title and description). */
export const getResourceDetectionSamples = (
  items: readonly { title: string; description?: string | null }[],
): string[] => items.flatMap((item) => [item.title, item.description ?? '']);

/** Plain-text sample of a decision overview (headline + description + body). */
export const getOverviewDetectionText = ({
  headline,
  description,
  body,
}: {
  headline?: string;
  description?: string;
  body?: string | JSONContent;
}): string => {
  const parts: string[] = [];
  if (headline) {
    parts.push(headline);
  }
  if (description) {
    parts.push(description);
  }
  if (typeof body === 'string') {
    parts.push(htmlToText(body));
  } else if (body) {
    try {
      parts.push(generateText(body, serverExtensions));
    } catch {
      // A malformed body doc contributes no detection signal — skip it.
    }
  }
  return joinSample(parts);
};
