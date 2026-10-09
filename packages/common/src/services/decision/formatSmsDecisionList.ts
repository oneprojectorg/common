import type { SmsDecisionListItem } from './listSmsDecisions';

const MAX_LISTED_DECISIONS = 10;
const EMPTY_MESSAGE = 'You are not a participant in any decision yet.';

export const formatSmsDecisionList = (
  decisions: ReadonlyArray<SmsDecisionListItem>,
): string => {
  if (decisions.length === 0) {
    return EMPTY_MESSAGE;
  }

  const lines = decisions
    .slice(0, MAX_LISTED_DECISIONS)
    .map(
      ({ name, slug, votingOpen }) =>
        `${name}${votingOpen ? ' (voting open)' : ''} - VOTE ${slug}`,
    );
  const remaining = decisions.length - lines.length;

  return [
    'Your decisions:',
    ...lines,
    ...(remaining > 0 ? [`and ${remaining} more`] : []),
  ].join('\n');
};
