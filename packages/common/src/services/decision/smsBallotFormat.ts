import { DEFAULT_MONEY_CURRENCY, isValidCurrencyCode } from '../../money';
import type { SmsBallotProposal } from './listSmsBallotProposals';
import {
  SMS_ELLIPSIS,
  SMS_MAX_BODY_LENGTH,
  clipSmsText,
  splitSmsBody,
} from './smsText';

export { SMS_MAX_BODY_LENGTH } from './smsText';

const SMS_LIST_TITLE_LENGTH = 100;

const smsCurrency = (currency: string): string =>
  isValidCurrencyCode(currency) ? currency : DEFAULT_MONEY_CURRENCY;

export const formatSmsCost = (cost: number | null, currency: string): string =>
  cost === null
    ? ''
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: smsCurrency(currency),
        maximumFractionDigits: 0,
      }).format(cost);

const formatSmsShortCost = (cost: number | null, currency: string): string =>
  cost === null
    ? ''
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: smsCurrency(currency),
        notation: 'compact',
        maximumFractionDigits: 1,
      })
        .format(cost)
        .replace(/K$/, 'k');

const withCost = (title: string, cost: number | null, currency: string) =>
  cost === null
    ? `"${clipSmsText(title, SMS_LIST_TITLE_LENGTH)}"`
    : `"${clipSmsText(title, SMS_LIST_TITLE_LENGTH)}" (${formatSmsCost(cost, currency)})`;

export const formatSmsProposalPages = ({
  decisionName,
  proposals,
  slug,
}: {
  decisionName: string;
  proposals: ReadonlyArray<SmsBallotProposal>;
  slug?: string;
}): string[] =>
  splitSmsBody({
    heading: `"${clipSmsText(decisionName, SMS_LIST_TITLE_LENGTH)}" has ${proposals.length} proposals:`,
    lines: proposals.map(({ code, title, cost, currency }) =>
      [
        code,
        clipSmsText(title, SMS_LIST_TITLE_LENGTH),
        formatSmsShortCost(cost, currency),
      ]
        .filter(Boolean)
        .join(' '),
    ),
    footer:
      slug === undefined
        ? 'Text a code to add it to your ballot, or INFO plus a code.'
        : `Text VOTE ${slug} to start your ballot, or INFO ${slug} plus a code.`,
  });

export const formatSmsProposalInfo = (
  proposal: SmsBallotProposal,
  { slug }: { slug?: string } = {},
): string => {
  const heading = `${proposal.code}: ${withCost(proposal.title, proposal.cost, proposal.currency)}.`;
  const action =
    slug === undefined
      ? `Text ${proposal.code} to add it to your ballot.`
      : `Text VOTE ${slug} to start your ballot.`;
  const room = SMS_MAX_BODY_LENGTH - heading.length - action.length - 2;
  const summary =
    proposal.summary && room > SMS_ELLIPSIS.length
      ? clipSmsText(proposal.summary, room)
      : null;

  return [heading, summary, action].filter(Boolean).join(' ');
};

export const formatSmsBallotWelcome = ({
  decisionName,
  proposals,
  maxVotesPerMember,
}: {
  decisionName: string;
  proposals: ReadonlyArray<SmsBallotProposal>;
  maxVotesPerMember: number | null;
}): string => {
  const only = proposals.length === 1 ? proposals[0] : undefined;
  if (only) {
    return `Voting is open for "${decisionName}". Reply YES to vote for ${withCost(only.title, only.cost, only.currency)}.`;
  }
  const limit =
    maxVotesPerMember === null
      ? 'as many proposals as you like'
      : `up to ${maxVotesPerMember} proposal${maxVotesPerMember === 1 ? '' : 's'}`;
  return `Voting is open for "${decisionName}". You can pick ${limit}. Text a code from your ballot guide to add your first pick, or PROPOSALS to browse.`;
};

export const formatSmsPicksLeft = (
  pickCount: number,
  maxVotesPerMember: number | null,
): string => {
  if (maxVotesPerMember === null) {
    return '';
  }
  const left = maxVotesPerMember - pickCount;
  return `${left} pick${left === 1 ? '' : 's'} left.`;
};

export const formatSmsPickConfirmation = ({
  notes = [],
  added,
  pickCount,
  maxVotesPerMember,
}: {
  notes?: ReadonlyArray<string>;
  added: ReadonlyArray<{ rank: number; proposal: SmsBallotProposal }>;
  pickCount: number;
  maxVotesPerMember: number | null;
}): string[] =>
  splitSmsBody({
    lines: [
      ...notes,
      ...added.map(
        ({ rank, proposal }) =>
          `Pick ${rank}: ${withCost(proposal.title, proposal.cost, proposal.currency)}.`,
      ),
    ],
    footer: [
      formatSmsPicksLeft(pickCount, maxVotesPerMember),
      'Text another code, LIST to see your ballot, or DONE to review.',
    ]
      .filter(Boolean)
      .join(' '),
    separator: ' ',
  });

export const formatSmsOverLimit = (maxVotesPerMember: number): string =>
  `You can pick ${maxVotesPerMember}. Reply REMOVE plus a code to make room.`;

export const SMS_BALLOT_EMPTY =
  'Your ballot is empty. Text a code to add a pick, or PROPOSALS to browse.';

export const formatSmsBallot = ({
  decisionName,
  picks,
}: {
  decisionName: string;
  picks: ReadonlyArray<SmsBallotProposal>;
}): string[] =>
  picks.length === 0
    ? [SMS_BALLOT_EMPTY]
    : splitSmsBody({
        heading: `Your ballot for "${clipSmsText(decisionName, SMS_LIST_TITLE_LENGTH)}":`,
        lines: picks.map(
          (pick, index) =>
            `${index + 1}. ${clipSmsText(pick.title, SMS_LIST_TITLE_LENGTH)}${pick.cost === null ? '' : ` ${formatSmsCost(pick.cost, pick.currency)}`}`,
        ),
        footer:
          'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
      });

export const SMS_BALLOT_SUBMITTED =
  'Your ballot is in. One ballot per person. How you vote is never public.';
