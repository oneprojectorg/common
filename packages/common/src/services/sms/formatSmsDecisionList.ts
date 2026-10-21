import type { SmsDecisionListItem } from '../decision/sms/listSmsDecisions';
import { clipSmsText, splitSmsBody } from './text';

const MAX_LISTED_DECISIONS = 10;
const SMS_LIST_NAME_LENGTH = 80;
const EMPTY_MESSAGE = 'You are not a participant in any decision yet.';

export const formatSmsDecisionList = (
  decisions: ReadonlyArray<SmsDecisionListItem>,
): string[] => {
  if (decisions.length === 0) {
    return [EMPTY_MESSAGE];
  }

  const listed = decisions.slice(0, MAX_LISTED_DECISIONS);
  const remaining = decisions.length - listed.length;

  return splitSmsBody({
    heading: 'Your decisions:',
    lines: listed.map(
      ({ name, slug, votingOpen }) =>
        `${clipSmsText(name, SMS_LIST_NAME_LENGTH)}${votingOpen ? ' (voting open)' : ''} - SHOW ${slug}`,
    ),
    footer: remaining > 0 ? `and ${remaining} more` : undefined,
  });
};
