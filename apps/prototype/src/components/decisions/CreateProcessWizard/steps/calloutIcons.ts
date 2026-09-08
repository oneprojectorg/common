import {
  LuBanknote,
  LuBell,
  LuCirclePlus,
  LuClipboardCheck,
  LuClock,
  LuCombine,
  LuEyeOff,
  LuFilePlus,
  LuFileText,
  LuFilter,
  LuListChecks,
  LuMail,
  LuMegaphone,
  LuMessageSquarePlus,
  LuRepeat,
  LuShare2,
  LuShuffle,
  LuSparkles,
  LuTrophy,
  LuUserCheck,
  LuUserPlus,
  LuUsers,
  LuVote,
  LuWallet,
} from 'react-icons/lu';

/**
 * A glyph per callout, matched on the copy itself.
 *
 * Literal rather than decorative: the icon says what the line is about — a
 * deadline is a clock, access is a person, money is a note — so the three rows
 * can be told apart at a glance instead of reading as three bullets wearing
 * different hats. Distinct within a card is what matters; the same glyph can
 * serve two cards that never appear together.
 *
 * Keyed by the English copy because that is what the wizard's content is written
 * in and these are the strings it ships. Anything unmatched falls through to the
 * keyword pass below, and then to a neutral glyph — a new callout gets something
 * sensible rather than nothing.
 */
const BY_COPY: Record<string, typeof LuClock> = {
  // Collect
  'Set your own questions': LuCirclePlus,
  'Open to all or invite-only': LuUserPlus,
  'Add a deadline or run on a timer': LuClock,
  'Add a deadline': LuClock,
  'Set what the application asks': LuFileText,
  'Set what the letter should cover': LuMail,

  // Review
  'Check eligibility and feasibility': LuClipboardCheck,
  'Merge or group duplicates': LuCombine,
  'Add questions for reviewers': LuMessageSquarePlus,
  'Run more than one round of review': LuRepeat,
  'Build a scoring rubric': LuListChecks,
  'Invite reviewers': LuUserPlus,
  'Choose what advances': LuFilter,

  // Develop
  'Choose who develops them': LuUsers,
  'Set what a proposal must include': LuFileText,
  'Add cost or budget details': LuBanknote,
  'Build on what the letter asked': LuFilePlus,
  'Add questions for the full application': LuMessageSquarePlus,

  // Vote
  'Choose how people vote': LuVote,
  'Set the budget and limits': LuWallet,
  'Decide who can vote': LuUserCheck,
  'Combine ways of voting': LuShuffle,
  'Keep votes anonymous': LuEyeOff,

  // Results
  'Publish what got funded': LuMegaphone,
  'Publish the awards': LuTrophy,
  'Notify participants': LuBell,
  'Notify applicants': LuBell,
  'Share a summary page': LuShare2,
};

/** Read in order, so "budget" beats "set" on "Set the budget and limits". */
const BY_KEYWORD: [RegExp, typeof LuClock][] = [
  [/deadline|timer|clock/i, LuClock],
  [/budget|cost|money|fund/i, LuWallet],
  [/vote|ballot/i, LuVote],
  [/anonym|private|hidden/i, LuEyeOff],
  [/rubric|score|scoring/i, LuListChecks],
  [/notify|email|alert/i, LuBell],
  [/publish|announce|share/i, LuMegaphone],
  [/invite|who can|access|only/i, LuUserPlus],
  [/reviewer|panel|people|participants/i, LuUsers],
  [/question|ask/i, LuMessageSquarePlus],
  [/round|again|repeat/i, LuRepeat],
  [/merge|group|combine/i, LuCombine],
  [/include|require|cover|template/i, LuFileText],
  [/advance|shortlist|filter|eligib/i, LuFilter],
];

export function calloutIcon(copy: string): typeof LuClock {
  const exact = BY_COPY[copy];

  if (exact) {
    return exact;
  }

  return BY_KEYWORD.find(([pattern]) => pattern.test(copy))?.[1] ?? LuSparkles;
}
