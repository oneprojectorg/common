import { clipSmsText, splitSmsBody } from './text';

const SMS_PROPOSAL_TITLE_LENGTH = 80;
const SMS_PROPOSAL_SUMMARY_LENGTH = 1200;
const EMPTY_BALLOT_MESSAGE = 'No proposals are on the ballot yet.';
const MORE_FOOTER = 'Text MORE for the next page.';
const NO_SUMMARY = 'No summary.';
const AGREE_FOOTER = 'Reply AGREE to affirm.';

const withCost = (text: string, cost: string | null): string =>
  cost ? `${text} (${cost})` : text;

export const formatSmsProposalPage = ({
  items,
  hasMore,
  heading = 'Proposals:',
  footer,
}: {
  items: ReadonlyArray<{ code: number; title: string; cost: string | null }>;
  hasMore: boolean;
  heading?: string;
  footer?: string;
}): string[] => {
  if (items.length === 0) {
    return [EMPTY_BALLOT_MESSAGE];
  }

  return splitSmsBody({
    heading,
    lines: items.map(({ code, title, cost }) =>
      withCost(
        `${code} ${clipSmsText(title, SMS_PROPOSAL_TITLE_LENGTH)}`,
        cost,
      ),
    ),
    footer: footer ?? (hasMore ? MORE_FOOTER : undefined),
  });
};

export const formatSmsProposalInfo = ({
  code,
  title,
  cost,
  summary,
}: {
  code: number;
  title: string;
  cost: string | null;
  summary: string | null;
}): string[] =>
  splitSmsBody({
    heading: withCost(
      `${code} "${clipSmsText(title, SMS_PROPOSAL_TITLE_LENGTH)}"`,
      cost,
    ),
    lines: [
      summary ? clipSmsText(summary, SMS_PROPOSAL_SUMMARY_LENGTH) : NO_SUMMARY,
    ],
  });

export const formatSmsAttestation = (text: string): string[] =>
  splitSmsBody({ lines: [text, AGREE_FOOTER] });
