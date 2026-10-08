import type { SmsBallotProposal } from './listSmsBallotProposals';

export const SMS_PROPOSALS_PAGE_SIZE = 5;

export const formatSmsCost = (cost: number | null, currency: string): string =>
  cost === null
    ? ''
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(cost);

const formatSmsShortCost = (cost: number | null, currency: string): string =>
  cost === null
    ? ''
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      })
        .format(cost)
        .replace(/K$/, 'k');

const withCost = (title: string, cost: number | null, currency: string) =>
  cost === null
    ? `"${title}"`
    : `"${title}" (${formatSmsCost(cost, currency)})`;

export const formatSmsProposalPage = ({
  decisionName,
  proposals,
  page,
}: {
  decisionName: string;
  proposals: ReadonlyArray<SmsBallotProposal>;
  page: number;
}): { body: string; hasMore: boolean } => {
  const start = page * SMS_PROPOSALS_PAGE_SIZE;
  const slice = proposals.slice(start, start + SMS_PROPOSALS_PAGE_SIZE);
  const hasMore = start + slice.length < proposals.length;
  const heading =
    page === 0
      ? `"${decisionName}" has ${proposals.length} proposals. First ${slice.length}:`
      : `Next ${slice.length}:`;
  const lines = slice.map(({ code, title, cost, currency }) =>
    [code, title, formatSmsShortCost(cost, currency)].filter(Boolean).join(' '),
  );
  const footer = hasMore
    ? 'Reply MORE for the next ones, or INFO plus a code.'
    : 'Text a code to add it to your ballot, or INFO plus a code.';

  return { body: [heading, ...lines, footer].join('\n'), hasMore };
};

export const formatSmsProposalInfo = (proposal: SmsBallotProposal): string =>
  [
    `${proposal.code}: ${withCost(proposal.title, proposal.cost, proposal.currency)}.`,
    proposal.summary,
    `Text ${proposal.code} to add it to your ballot.`,
  ]
    .filter(Boolean)
    .join(' ');

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
  added,
  pickCount,
  maxVotesPerMember,
}: {
  added: ReadonlyArray<{ rank: number; proposal: SmsBallotProposal }>;
  pickCount: number;
  maxVotesPerMember: number | null;
}): string =>
  [
    ...added.map(
      ({ rank, proposal }) =>
        `Pick ${rank}: ${withCost(proposal.title, proposal.cost, proposal.currency)}.`,
    ),
    formatSmsPicksLeft(pickCount, maxVotesPerMember),
    'Text another code, LIST to see your ballot, or DONE to review.',
  ]
    .filter(Boolean)
    .join(' ');

export const formatSmsOverLimit = (maxVotesPerMember: number): string =>
  `You can pick ${maxVotesPerMember}. Reply REMOVE plus a code to make room.`;

export const formatSmsBallot = ({
  decisionName,
  picks,
}: {
  decisionName: string;
  picks: ReadonlyArray<SmsBallotProposal>;
}): string => {
  if (picks.length === 0) {
    return 'Your ballot is empty. Text a code to add a pick, or PROPOSALS to browse.';
  }
  return [
    `Your ballot for "${decisionName}":`,
    ...picks.map(
      (pick, index) =>
        `${index + 1}. ${pick.title}${pick.cost === null ? '' : ` ${formatSmsCost(pick.cost, pick.currency)}`}`,
    ),
    'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
  ].join('\n');
};

export const SMS_BALLOT_SUBMITTED =
  'Your ballot is in. One ballot per person. How you vote is never public.';
