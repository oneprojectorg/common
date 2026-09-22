import type { ComponentType } from 'react';
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

import type { WizardCopyKey } from '../types';

type IconComponent = ComponentType<{ className?: string }>;

/**
 * A glyph per capability line, keyed on the copy id.
 *
 * Literal rather than decorative: the icon says what the line is about, so
 * the rows of a card can be told apart at a glance. Distinct within a card
 * is what matters; the same glyph can serve two cards that never appear
 * together.
 *
 * Keyed on the id rather than the English copy, so a copy edit cannot
 * silently change an icon and a renamed key fails `typecheck`.
 */
const BY_ID: Partial<Record<WizardCopyKey, IconComponent>> = {
  addCostBudgetDetails: LuBanknote,
  addDeadline: LuClock,
  addDeadlineRunTimer: LuClock,
  addQuestionsFullApplication: LuMessageSquarePlus,
  addQuestionsFullerVersion: LuMessageSquarePlus,
  addQuestionsReviewers: LuMessageSquarePlus,
  buildScoringRubric: LuListChecks,
  buildWhatLetterAsked: LuFilePlus,
  buildWhatWasAlreadySubmitted: LuFilePlus,
  checkEligibilityFeasibility: LuClipboardCheck,
  chooseHowPeopleVote: LuVote,
  chooseWhatAdvances: LuFilter,
  chooseWhoDevelopsThem: LuUsers,
  combineWaysVoting: LuShuffle,
  decideWhoCanVote: LuUserCheck,
  inviteReviewers: LuUserPlus,
  inviteReviewersPanel: LuUserPlus,
  inviteYourGroup: LuUsers,
  keepVotesAnonymous: LuEyeOff,
  letMembersCommentLikeShow: LuMessageSquarePlus,
  letPeopleCommentLikeShow: LuMessageSquarePlus,
  mergeGroupDuplicates: LuCombine,
  noClosingDateRunsLong: LuClock,
  notifyApplicants: LuBell,
  notifyEveryoneWhoTookPart: LuBell,
  notifyParticipants: LuBell,
  openAllInviteOnly: LuUserPlus,
  publishAwards: LuTrophy,
  publishOutcome: LuMegaphone,
  publishWhatGotFunded: LuMegaphone,
  publishWhatGroupLanded: LuMegaphone,
  runMoreThanOneRound: LuRepeat,
  runVoteItemWhenYou: LuVote,
  scoreBlindIfYouWant: LuEyeOff,
  setBudgetLimits: LuWallet,
  setDeadline: LuClock,
  setWhatApplicationAsks: LuFileText,
  setWhatLetterShouldCover: LuMail,
  setWhatProposalMustInclude: LuFileText,
  setYourOwnQuestions: LuCirclePlus,
  shareSummaryPage: LuShare2,
  showTitlesOnlyFullEntries: LuFileText,
};

export function calloutIcon(id: WizardCopyKey): IconComponent {
  return BY_ID[id] ?? LuSparkles;
}
