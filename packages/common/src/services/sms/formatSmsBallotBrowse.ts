import { clipSmsText } from './text';

const SMS_DECISION_NAME_LENGTH = 80;

export const SMS_BROWSE_MORE_FOOTER =
  'Reply MORE for the rest, or INFO plus a code.';
export const SMS_BROWSE_LAST_FOOTER = 'Reply INFO plus a code for details.';
export const SMS_BROWSE_START_MESSAGE = 'Text PROPOSALS to start browsing.';
export const SMS_BROWSE_END_MESSAGE =
  'That was the last page. Text PROPOSALS to start again.';
export const SMS_PROPOSALS_NEEDS_DECISION_MESSAGE =
  'Text PROPOSALS and a decision name, for example PROPOSALS columbus.';
export const SMS_INFO_NEEDS_CODE_MESSAGE =
  'Text INFO and a proposal code, for example INFO 214.';
export const SMS_INFO_NEEDS_DECISION_MESSAGE =
  'Text PROPOSALS first so INFO knows which decision.';

export const formatSmsBallotPageHeading = ({
  scope,
  total,
  count,
  continued,
}: {
  scope: string;
  total: number;
  count: number;
  continued: boolean;
}): string =>
  continued
    ? `Next ${count}:`
    : `${scope} has ${total} ${total === 1 ? 'proposal' : 'proposals'}. First ${count}:`;

export const formatSmsBallotScope = ({
  district,
  decisionName,
}: {
  district: string | null;
  decisionName: string;
}): string =>
  district ?? `"${clipSmsText(decisionName, SMS_DECISION_NAME_LENGTH)}"`;

export const formatSmsRegisterFirst = (decisionName: string): string =>
  `Text VOTE to register for "${clipSmsText(decisionName, SMS_DECISION_NAME_LENGTH)}" before browsing its proposals.`;

export const formatSmsProposalNotOnBallot = (code: number): string =>
  `No proposal with code ${code} is on your ballot.`;
