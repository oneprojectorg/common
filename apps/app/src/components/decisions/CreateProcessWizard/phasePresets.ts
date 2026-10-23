// What the wizard offers for a named shape: hand-written phase lists, and the grant transform. Read by the mapping step.
import type {
  GrantDecision,
  ShapeKey,
  WizardCopyKey,
  WizardPhase,
} from './types';

export const VOTE_CAPABILITIES: WizardCopyKey[] = [
  'chooseHowPeopleVote',
  'combineWaysVoting',
  'decideWhoCanVote',
  'keepVotesAnonymous',
];

const PB_VOTE: WizardPhase = {
  name: 'putVote',
  phaseName: 'votePhase',
  kind: 'voting',
  capabilities: ['chooseHowPeopleVote', 'setBudgetLimits', 'decideWhoCanVote'],
  norm: 'pbVoteNorm',
};

const PB_RESULTS: WizardPhase = {
  name: 'shareResults',
  phaseName: 'seeResults',
  kind: 'results',
  capabilities: [
    'publishWhatGotFunded',
    'notifyParticipants',
    'shareSummaryPage',
  ],
};

const GRANT_AWARDS: WizardPhase = {
  name: 'shareAwards',
  phaseName: 'seeAwards',
  kind: 'results',
  capabilities: ['publishAwards', 'notifyApplicants', 'shareSummaryPage'],
};

const GRANT_VOTE: WizardPhase = {
  name: 'putVote',
  phaseName: 'votePhase',
  kind: 'voting',
  description: 'grantVoteDescription',
  capabilities: VOTE_CAPABILITIES,
};

const PRESETS: Record<ShapeKey, WizardPhase[]> = {
  ideas: [
    {
      name: 'collectIdeas',
      phaseName: 'shareYourIdeas',
      kind: 'submissions',
      description: 'collectIdeasDescription',
      capabilities: [
        'setYourOwnQuestions',
        'openAllInviteOnly',
        'addDeadlineRunTimer',
      ],
    },
    {
      name: 'screenIdeas',
      phaseName: 'reviewIdeas',
      kind: 'review',
      description: 'screenIdeasDescription',
      capabilities: [
        'checkEligibilityFeasibility',
        'mergeGroupDuplicates',
        'addQuestionsReviewers',
        'runMoreThanOneRound',
      ],
    },
    {
      name: 'buildProposals',
      phaseName: 'buildProposalsPhaseName',
      kind: 'submissions',
      description: 'buildProposalsDescription',
      capabilities: [
        'chooseWhoDevelopsThem',
        'setWhatProposalMustInclude',
        'addCostBudgetDetails',
      ],
    },
    PB_VOTE,
    PB_RESULTS,
  ],

  proposals: [
    {
      name: 'collectProposals',
      phaseName: 'sendYourProposals',
      kind: 'submissions',
      description: 'collectCompleteProposalsDescription',
      capabilities: [
        'setYourOwnQuestions',
        'openAllInviteOnly',
        'addDeadlineRunTimer',
      ],
    },
    {
      name: 'screenProposals',
      phaseName: 'reviewProposals',
      kind: 'review',
      capabilities: [
        'checkEligibilityFeasibility',
        'addQuestionsReviewers',
        'runMoreThanOneRound',
      ],
    },
    PB_VOTE,
    PB_RESULTS,
  ],

  loi: [
    {
      name: 'collectLettersIntent',
      phaseName: 'sendLetterIntent',
      kind: 'submissions',
      description: 'collectLettersIntentDescription',
      capabilities: [
        'setWhatLetterShouldCover',
        'openAllInviteOnly',
        'addDeadline',
      ],
    },
    {
      name: 'pickShortlist',
      phaseName: 'shortlisting',
      kind: 'review',
      description: 'pickShortlistDescription',
      capabilities: [
        'buildScoringRubric',
        'addQuestionsReviewers',
        'inviteReviewers',
        'chooseWhatAdvances',
      ],
    },
    {
      name: 'collectFullApplications',
      phaseName: 'sendYourApplication',
      kind: 'submissions',
      description: 'collectFullApplicationsDescription',
      capabilities: [
        'buildWhatLetterAsked',
        'addQuestionsFullApplication',
        'addDeadline',
      ],
    },
    {
      name: 'chooseWhosFunded',
      phaseName: 'reviewDecide',
      kind: 'review',
      description: 'chooseFromFullApplicationsDescription',
      capabilities: [
        'buildScoringRubric',
        'inviteReviewers',
        'runMoreThanOneRound',
        'chooseWhatAdvances',
      ],
    },
    GRANT_AWARDS,
  ],

  single: [
    {
      name: 'collectApplications',
      phaseName: 'sendYourApplication',
      kind: 'submissions',
      capabilities: [
        'setWhatApplicationAsks',
        'openAllInviteOnly',
        'addDeadline',
      ],
    },
    {
      name: 'chooseWhosFunded',
      phaseName: 'reviewDecide',
      kind: 'review',
      description: 'chooseFromApplicationsDescription',
      capabilities: [
        'buildScoringRubric',
        'addQuestionsReviewers',
        'inviteReviewers',
        'chooseWhatAdvances',
      ],
    },
    GRANT_AWARDS,
  ],
};

export const presetPhases = (shape: ShapeKey | null): WizardPhase[] =>
  shape ? PRESETS[shape] : [];

/** Only the last review changes: an earlier one picks who advances, whoever decides. */
export function applyGrantDecision(
  phases: WizardPhase[],
  decision: GrantDecision | null,
): WizardPhase[] {
  if (!decision || decision === 'rubric') {
    return phases;
  }

  const lastReview = phases.map((p) => p.kind).lastIndexOf('review');
  const deciding = phases[lastReview];

  if (!deciding) {
    return phases;
  }

  if (decision === 'applicants') {
    return phases.map((p, i) => (i === lastReview ? GRANT_VOTE : p));
  }

  const narrowed: WizardPhase = {
    ...deciding,
    name: 'narrowField',
    phaseName: 'pickFinalists',
    description: 'narrowFieldDescription',
  };

  return [
    ...phases.slice(0, lastReview),
    narrowed,
    GRANT_VOTE,
    ...phases.slice(lastReview + 1),
  ];
}
