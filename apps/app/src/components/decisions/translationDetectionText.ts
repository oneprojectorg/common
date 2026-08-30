import {
  type Proposal,
  type ProposalTemplateSchema,
  type RubricTemplateSchema,
  parseSchemaOptions,
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
 * each option's label. The reviewer reads this alongside the proposal, so a
 * foreign-language rubric has to offer translation even when the proposal
 * itself is already in the reader's language.
 */
export const getRubricDetectionText = (
  rubricTemplate: RubricTemplateSchema | null | undefined,
): string => {
  const parts: string[] = [];

  for (const property of Object.values(rubricTemplate?.properties ?? {})) {
    if (property.title) {
      parts.push(property.title);
    }
    if (property.description) {
      parts.push(property.description);
    }
    for (const option of parseSchemaOptions(property)) {
      if (option.title) {
        parts.push(option.title);
      }
    }
  }

  return joinSample(parts);
};

/**
 * Joins a heading to the text under it — one sample rather than two.
 *
 * A heading on its own is a bare label: too short to carry a verdict, and long
 * enough to be misread when it does clear the floor, since a noun phrase with
 * no function words in it looks like nothing in particular. The text under it
 * is prose, which is what detection can actually read. Joined, the prose
 * carries the pair.
 *
 * The cost is that one verdict now answers for both fields, so an item whose
 * heading and body are in different languages reports only the longer one's.
 * Registering the fields separately as well would surface the other language,
 * but it also puts every bare heading back in front of the detector, and
 * measured over realistic English titles that misreads far more often than the
 * half-translated case it would rescue.
 */
const joinHeadingAndText = (
  heading?: string | null,
  text?: string | null,
): string => joinSample([heading?.trim() ?? '', text?.trim() ?? '']);

/** Plain-text sample of a resource (title + description). */
export const getResourceDetectionText = ({
  title,
  description,
}: {
  title?: string | null;
  description?: string | null;
}): string => joinHeadingAndText(title, description);

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

/**
 * Plain-text sample of a phase's headline and description. Both the proposals
 * list and the review page render them and register them, so the mapping lives
 * here rather than being spelled out at each of them.
 *
 * The phase's `additionalInfo` is authored and translated too but is not
 * sampled, so a phase whose only foreign copy lives there offers no badge.
 * That gap predates this helper and outlives it — folding the field in means
 * running it through `htmlToText` first, since it is markup.
 */
export const getPhaseDetectionText = (phase: {
  headline?: string | null;
  description?: string | null;
}): string => joinHeadingAndText(phase.headline, phase.description);
