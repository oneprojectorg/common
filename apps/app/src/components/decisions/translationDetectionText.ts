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
 * Detection samples for one title/description pair — the joined text first,
 * then each field on its own.
 *
 * The join is what detection usually reads: a title alone is a bare label,
 * too short for a verdict, and registering the two fields separately leaves
 * neither with enough prose. Joining them makes one sample the detector can
 * actually judge.
 *
 * The fields follow it because the join answers with one language, and an item
 * whose title and description are in different languages has the shorter one's
 * verdict swallowed by the longer one's. That is the half-translated case, and
 * the reader still needs the badge for it. Registering both costs a cached
 * detection per field and can only add verdicts, never remove one.
 */
const getPairDetectionSamples = (
  first?: string | null,
  second?: string | null,
): string[] => {
  const parts = [first?.trim() ?? '', second?.trim() ?? ''].filter(Boolean);

  return parts.length > 1 ? [joinSample(parts), ...parts] : parts;
};

/** Detection samples for a resource (title + description). */
export const getResourceDetectionSamples = ({
  title,
  description,
}: {
  title?: string | null;
  description?: string | null;
}): string[] => getPairDetectionSamples(title, description);

/**
 * Plain-text sample of authored headline/description/body copy — the decision
 * overview and, without a body, the phase copy (see
 * {@link getPhaseDetectionText}).
 */
export const getOverviewDetectionText = ({
  headline,
  description,
  body,
}: {
  headline?: string | null;
  description?: string | null;
  body?: string | JSONContent | null;
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
 * Detection samples for a phase's authored copy. Both the proposals list and
 * the review page render it and register it, so the mapping lives here rather
 * than being spelled out at each of them.
 */
export const getPhaseDetectionSamples = (phase: {
  headline?: string | null;
  description?: string | null;
}): string[] => getPairDetectionSamples(phase.headline, phase.description);
