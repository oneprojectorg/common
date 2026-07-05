import { type Proposal, serverExtensions } from '@op/common/client';
import { getTextPreview } from '@op/core';
import { type JSONContent, generateText } from '@tiptap/core';

/** Cap the sample fed to language detection — a few hundred chars already suffices. */
const MAX_SAMPLE_LENGTH = 2000;

/** The only proposal field language detection reads. */
type ProposalTextSource = Pick<Proposal, 'htmlContent'>;

const htmlToText = (html: string): string =>
  getTextPreview({ content: html, maxLines: 20, maxLength: MAX_SAMPLE_LENGTH });

/** Plain-text sample of a proposal's title + body, for language detection. */
export const getProposalDetectionText = (
  proposal: ProposalTextSource,
): string => {
  const values = Object.values(proposal.htmlContent ?? {}).filter(
    (value): value is string => typeof value === 'string',
  );
  return values.map(htmlToText).join('\n').slice(0, MAX_SAMPLE_LENGTH);
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
  return parts.join('\n').slice(0, MAX_SAMPLE_LENGTH);
};
