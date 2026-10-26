// The phases each set of answers maps to: hand-written lists for a named shape, the grant transform, and what the other pathway composes from its questions. Read by the mapping step.
import { type ReactNode, createElement } from 'react';

import type { TranslateFn } from '@/lib/i18n';

import { subjectMeta } from './questions';
import type {
  CapabilityKey,
  Decision,
  GrantDecision,
  ShapeKey,
  SubmitKey,
  WizardAnswers,
  WizardCopyKey,
  WizardPhase,
} from './types';

export function phasesFor(answers: WizardAnswers): WizardPhase[] {
  const { type, shape, grantDecision } = answers;

  if (type === 'other') {
    return composeOtherPhases(answers);
  }

  if (type === 'grant') {
    return applyGrantDecision(presetPhases(shape), grantDecision);
  }

  return presetPhases(shape);
}

const VOTE_CAPABILITIES: CapabilityKey[] = [
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

interface Intake {
  name: WizardCopyKey;
  phaseName: WizardCopyKey;
  description: WizardCopyKey;
  recap: WizardCopyKey;
}

const INTAKE: Record<SubmitKey, Intake> = {
  applications: {
    name: 'collectApplications',
    phaseName: 'sendYourApplication',
    description: 'collectApplicationsDescription',
    recap: 'recapIntakeApplications',
  },
  proposals: {
    name: 'collectProposals',
    phaseName: 'sendYourProposal',
    description: 'collectWrittenProposalsDescription',
    recap: 'recapIntakeWritten',
  },
  rough: {
    name: 'collectIdeas',
    phaseName: 'shareYourIdeas',
    description: 'collectIdeasDescription',
    recap: 'recapIntakeRough',
  },
  nominations: {
    name: 'collectNominations',
    phaseName: 'makeNomination',
    description: 'collectNominationsDescription',
    recap: 'recapIntakeNominations',
  },
  none: {
    name: 'collectSubmissions',
    phaseName: 'sendYourSubmission',
    description: 'collectSubmissionsDescription',
    recap: 'recapIntakeNone',
  },
};

const DECISION_RECAP: Record<Decision, WizardCopyKey> = {
  vote: 'recapDecisionVote',
  review: 'recapDecisionReview',
  both: 'recapDecisionBoth',
  agree: 'recapDecisionAgree',
};

const REVIEW_CAPABILITIES: CapabilityKey[] = [
  'buildScoringRubric',
  'inviteReviewersPanel',
  'scoreBlindIfYouWant',
  'chooseWhatAdvances',
];

export function composeOtherPhases(answers: WizardAnswers): WizardPhase[] {
  const submits = answers.submits ?? 'none';

  if (answers.cadence === 'ongoing') {
    // An always-open process collects something, so nothing to submit reads as proposals.
    const intake = INTAKE[submits === 'none' ? 'proposals' : submits];

    return [
      {
        name: intake.name,
        phaseName: intake.phaseName,
        kind: 'submissions',
        description: 'ongoingIntakeDescription',
        capabilities: [
          'setYourOwnQuestions',
          'inviteYourGroup',
          'letMembersCommentLikeShow',
          'noClosingDateRunsLong',
        ],
        norm: 'ongoingIntakeNorm',
      },
    ];
  }

  const decision = answers.decision ?? 'vote';
  const discussionOnly = decision === 'agree';
  const phases: WizardPhase[] = [];

  if (submits !== 'none') {
    const intake = INTAKE[submits];
    const supportCapabilities: CapabilityKey[] = discussionOnly
      ? ['letPeopleCommentLikeShow']
      : [];

    phases.push({
      name: intake.name,
      phaseName: intake.phaseName,
      kind: 'submissions',
      description: intake.description,
      capabilities: [
        'setYourOwnQuestions',
        'openAllInviteOnly',
        'addDeadline',
        ...supportCapabilities,
      ],
    });
  }

  if (decision === 'both' || (decision === 'review' && submits === 'rough')) {
    phases.push({
      name: 'narrowDown',
      phaseName: 'shortlisting',
      kind: 'review',
      description:
        decision === 'both'
          ? 'narrowDownDescription'
          : 'narrowDownToWorkUpDescription',
      capabilities: REVIEW_CAPABILITIES,
    });
  }

  if (submits === 'rough') {
    phases.push({
      name: 'workThemUp',
      phaseName: 'buildThemUp',
      kind: 'submissions',
      description: 'workThemUpDescription',
      capabilities: [
        'buildWhatWasAlreadySubmitted',
        'addQuestionsFullerVersion',
        'setDeadline',
      ],
    });
  }

  if (decision === 'review') {
    phases.push({
      name: 'reviewDecide',
      phaseName: 'reviewDecide',
      kind: 'review',
      description: 'reviewDecideDescription',
      capabilities: REVIEW_CAPABILITIES,
    });
  }

  if (decision === 'vote' || decision === 'both') {
    phases.push({
      name: subjectMeta(answers.subject).voteName,
      phaseName: 'votePhase',
      kind: 'voting',
      description: 'groupVoteDescription',
      capabilities: VOTE_CAPABILITIES,
    });
  }

  phases.push({
    name: 'shareWhatWasDecided',
    phaseName: 'seeWhatWasDecided',
    kind: 'results',
    capabilities: [
      discussionOnly ? 'publishWhatGroupLanded' : 'publishOutcome',
      'showTitlesOnlyFullEntries',
      'notifyEveryoneWhoTookPart',
    ],
  });

  return phases;
}

export function subjectPhrase(
  { subject, subjectText }: WizardAnswers,
  t: TranslateFn<'decisions.createWizard'>,
): string {
  const words = subjectText.trim();

  return subject === 'else' && words ? words : t(subjectMeta(subject).noun);
}

export function describeOther(
  answers: WizardAnswers,
  t: TranslateFn<'decisions.createWizard'>,
): ReactNode {
  const subject = subjectPhrase(answers, t);
  const bdi = (chunks: ReactNode) => createElement('bdi', null, chunks);

  if (answers.cadence === 'ongoing') {
    return t.rich('recapOngoing', { subject, bdi });
  }

  return t.rich('recapTimeline', {
    subject,
    bdi,
    intake: t(INTAKE[answers.submits ?? 'none'].recap),
    call: t(DECISION_RECAP[answers.decision ?? 'vote']),
  });
}
