import type { ProcessInstance } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
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
 * Plain-text sample of the process as one translatable object: the overview,
 * the current phase's copy and every phase name — what `translateDecision`
 * translates, so the link is offered when any of it is in another language.
 */
export const getDecisionDetectionText = ({
  name,
  description,
  instanceData,
  currentStateId,
}: Pick<
  ProcessInstance,
  'name' | 'description' | 'instanceData' | 'currentStateId'
>): string => {
  const overview = instanceData?.overview;
  const phases = instanceData?.phases ?? [];
  const currentPhase = phases.find((phase) => phase.phaseId === currentStateId);

  return joinSample([
    getOverviewDetectionText({
      headline: overview?.headline ?? name,
      description: overview?.description ?? description ?? undefined,
      body: overview?.body,
    }),
    currentPhase?.headline ?? '',
    currentPhase?.description ?? '',
    currentPhase?.additionalInfo ? htmlToText(currentPhase.additionalInfo) : '',
    ...phases.map((phase) => phase.name ?? ''),
  ]);
};
