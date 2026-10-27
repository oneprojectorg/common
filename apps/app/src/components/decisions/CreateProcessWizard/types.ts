import type { PhaseKind, ProcessType } from '@op/common/client';
import type { MessageKeys, Messages, NestedKeyOf } from 'next-intl';

type WizardMessages = Messages['decisions']['createWizard'];

export type WizardCopyKey = MessageKeys<
  WizardMessages,
  NestedKeyOf<WizardMessages>
>;

/** Grant shapes, then budgeting shapes; the other pathway composes its phases from its questions instead. */
export const SHAPES = ['single', 'loi', 'ideas', 'proposals'] as const;

export type ShapeKey = (typeof SHAPES)[number];

export const GRANT_DECISIONS = ['rubric', 'applicants', 'hybrid'] as const;

export type GrantDecision = (typeof GRANT_DECISIONS)[number];

export const SUBJECTS = ['funding', 'ideas', 'people', 'else'] as const;

export type Subject = (typeof SUBJECTS)[number];

export const CADENCES = ['timeline', 'ongoing'] as const;

export type Cadence = (typeof CADENCES)[number];

export const SUBMIT_KEYS = [
  'applications',
  'proposals',
  'rough',
  'nominations',
  'none',
] as const;

export type SubmitKey = (typeof SUBMIT_KEYS)[number];

export const DECISIONS = ['vote', 'review', 'both', 'agree'] as const;

export type Decision = (typeof DECISIONS)[number];

export interface WizardAnswers {
  type: ProcessType | null;
  shape: ShapeKey | null;
  grantDecision: GrantDecision | null;
  subject: Subject | null;
  /** Something else, in the creator's own words. */
  subjectText: string;
  cadence: Cadence | null;
  submits: SubmitKey | null;
  decision: Decision | null;
  name: string;
}

/** Every capability a phase may list; the UI maps each one to an icon. */
export type CapabilityKey = Extract<
  WizardCopyKey,
  | 'addCostBudgetDetails'
  | 'addDeadline'
  | 'addDeadlineRunTimer'
  | 'addQuestionsFullApplication'
  | 'addQuestionsFullerVersion'
  | 'addQuestionsReviewers'
  | 'buildScoringRubric'
  | 'buildWhatLetterAsked'
  | 'buildWhatWasAlreadySubmitted'
  | 'checkEligibilityFeasibility'
  | 'chooseHowPeopleVote'
  | 'chooseWhatAdvances'
  | 'chooseWhoDevelopsThem'
  | 'combineWaysVoting'
  | 'decideWhoCanVote'
  | 'inviteReviewers'
  | 'inviteReviewersPanel'
  | 'inviteYourGroup'
  | 'keepVotesAnonymous'
  | 'letMembersCommentLikeShow'
  | 'letPeopleCommentLikeShow'
  | 'mergeGroupDuplicates'
  | 'noClosingDateRunsLong'
  | 'notifyApplicants'
  | 'notifyEveryoneWhoTookPart'
  | 'notifyParticipants'
  | 'openAllInviteOnly'
  | 'publishAwards'
  | 'publishOutcome'
  | 'publishWhatGotFunded'
  | 'publishWhatGroupLanded'
  | 'runMoreThanOneRound'
  | 'scoreBlindIfYouWant'
  | 'setBudgetLimits'
  | 'setDeadline'
  | 'setWhatApplicationAsks'
  | 'setWhatLetterShouldCover'
  | 'setWhatProposalMustInclude'
  | 'setYourOwnQuestions'
  | 'shareSummaryPage'
  | 'showTitlesOnlyFullEntries'
>;

export interface WizardPhase {
  /** The pitch while choosing; `phaseName` is the timeline label. */
  name: WizardCopyKey;
  phaseName: WizardCopyKey;
  kind: PhaseKind;
  description?: WizardCopyKey;
  capabilities: CapabilityKey[];
  norm?: WizardCopyKey;
}

/** What the wizard hands over to create the process. */
export interface ProcessDraft {
  type: ProcessType;
  name: string;
  phases: WizardPhase[];
}

export interface Choice<K extends string> {
  key: K;
  label: WizardCopyKey;
  description?: WizardCopyKey;
}
