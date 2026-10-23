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
  LuTrophy,
  LuUserCheck,
  LuUserPlus,
  LuUsers,
  LuVote,
  LuWallet,
} from 'react-icons/lu';

import type { WizardCopyKey } from '../types';

type IconComponent = ComponentType<{ className?: string }>;

const BY_ID = {
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
  scoreBlindIfYouWant: LuEyeOff,
  setBudgetLimits: LuWallet,
  setDeadline: LuClock,
  setWhatApplicationAsks: LuFileText,
  setWhatLetterShouldCover: LuMail,
  setWhatProposalMustInclude: LuFileText,
  setYourOwnQuestions: LuCirclePlus,
  shareSummaryPage: LuShare2,
  showTitlesOnlyFullEntries: LuFileText,
} satisfies Partial<Record<WizardCopyKey, IconComponent>>;

/** Every capability a piece may list; a new one needs an icon here. */
export type CapabilityKey = keyof typeof BY_ID;

export function capabilityIcon(id: CapabilityKey): IconComponent {
  return BY_ID[id];
}
