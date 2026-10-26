import { clipSmsText, splitSmsBody } from './text';

const SMS_TITLE_LENGTH = 80;

export const SMS_BALLOT_SUBMITTED_MESSAGE =
  'Your ballot is in. One ballot per person. However, your vote is never public.';
export const SMS_BALLOT_ALREADY_SUBMITTED_MESSAGE =
  'Your ballot is already in. One ballot per person.';
export const SMS_BALLOT_EMPTY_SUBMIT_MESSAGE =
  'Your ballot is empty. Add a pick before you SUBMIT.';
export const SMS_BALLOT_EMPTY_MESSAGE =
  'Your ballot is empty. Text a code from your guide, or PROPOSALS to browse.';
export const SMS_BALLOT_NEEDS_DECISION_MESSAGE =
  'Text PROPOSALS and a decision name first, then pick by code.';
export const SMS_REMOVE_USAGE_MESSAGE =
  'Text REMOVE and a code, for example REMOVE 214.';
export const SMS_MOVE_USAGE_MESSAGE =
  'Text MOVE, a code and a position, for example MOVE 214 1.';
export const SMS_FIRST_PICK_FOOTER =
  'Text another code, LIST to see your ballot, or DONE to review.';
export const SMS_RANKING_NOTE =
  "Your order is your ranking: if a pick can't be funded, your support moves to your next choice.";
export const SMS_SUBMIT_PROMPT = 'Reply SUBMIT to cast your ballot.';
export const SMS_LIST_FOOTER = 'Text DONE to review, or a code to add.';

const quoted = (title: string): string =>
  `"${clipSmsText(title, SMS_TITLE_LENGTH)}"`;

const withCost = (text: string, cost: string | null): string =>
  cost ? `${text} (${cost})` : text;

export interface SmsFormattedPick {
  position: number;
  title: string;
  cost: string | null;
}

export const formatSmsPicksAdded = ({
  picks,
  remaining,
  firstPick,
}: {
  picks: ReadonlyArray<SmsFormattedPick>;
  remaining: string | null;
  firstPick: boolean;
}): string[] => {
  const sentences = picks.map(
    (pick) =>
      `${withCost(`Pick ${pick.position}: ${quoted(pick.title)}`, pick.cost)}.`,
  );
  const left = remaining ? `${remaining} left.` : null;
  const tail = firstPick ? SMS_FIRST_PICK_FOOTER : null;
  return splitSmsBody({
    lines: [[...sentences, left, tail].filter(Boolean).join(' ')],
  });
};

export const formatSmsPickOverBudget = ({
  title,
  cost,
  remaining,
}: {
  title: string;
  cost: string;
  remaining: string;
}): string[] =>
  splitSmsBody({
    lines: [
      `${quoted(title)} costs ${cost}. You have ${remaining} left. Reply REMOVE plus a code to make room, or pick a smaller project.`,
    ],
  });

export const formatSmsPickDuplicate = ({
  title,
  position,
}: {
  title: string;
  position: number;
}): string => `${quoted(title)} is already pick ${position}.`;

export const formatSmsBallot = ({
  scope,
  picks,
  allocated,
  unspent,
  review,
  ranked = true,
}: {
  scope: string;
  picks: ReadonlyArray<SmsFormattedPick>;
  allocated: string | null;
  unspent: string | null;
  review: boolean;
  ranked?: boolean;
}): string[] => {
  if (picks.length === 0) {
    return [SMS_BALLOT_EMPTY_MESSAGE];
  }
  const totals =
    allocated && unspent ? `${allocated} allocated, ${unspent} unspent.` : null;
  return splitSmsBody({
    heading: `Your ${scope} ballot:`,
    lines: [
      ...picks.map(
        (pick) =>
          `${pick.position}. ${clipSmsText(pick.title, SMS_TITLE_LENGTH)}${pick.cost ? ` ${pick.cost}` : ''}.`,
      ),
      ...(totals ? [totals] : []),
      ...(review && ranked ? [SMS_RANKING_NOTE] : []),
    ],
    footer: review ? SMS_SUBMIT_PROMPT : SMS_LIST_FOOTER,
  });
};

export const formatSmsPickRemoved = ({
  title,
  remaining,
}: {
  title: string;
  remaining: string | null;
}): string =>
  remaining
    ? `Removed ${quoted(title)}. ${remaining} left.`
    : `Removed ${quoted(title)}.`;

export const formatSmsPickMoved = ({
  title,
  position,
}: {
  title: string;
  position: number;
}): string => `${quoted(title)} is now pick ${position}.`;

export const formatSmsNotOnYourBallot = (code: number): string =>
  `No pick with code ${code} is on your ballot.`;

export const formatSmsBallotRefused = (reason: string): string =>
  `Your ballot was not cast: ${reason}`;

export const formatSmsPickLimitReached = ({
  title,
  limit,
}: {
  title: string;
  limit: number;
}): string =>
  `${quoted(title)} was not added: your ballot already holds the most picks allowed (${limit}). REMOVE one to add another.`;
