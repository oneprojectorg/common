import type {
  Choice,
  GrantDecision,
  GrantShape,
  PbShape,
  PhaseType,
  ProcessPiece,
  ProcessType,
  ShapeKey,
  WizardCopyKey,
} from './types';

export const PHASE_TYPE_LABEL: Record<PhaseType, WizardCopyKey> = {
  submissions: 'submissionsPhase',
  review: 'reviewPhase',
  voting: 'votingPhase',
  results: 'resultsPhase',
};

export interface TypeMeta {
  label: WizardCopyKey;
  /** A whole noun phrase: articles inflect, so an adjective can't be interpolated. */
  subjectPhrase: WizardCopyKey;
  description: WizardCopyKey;
}

export const TYPE_ORDER: ProcessType[] = ['grant', 'pb', 'other'];

export const TYPE_META: Record<ProcessType, TypeMeta> = {
  grant: {
    label: 'grantTypeLabel',
    subjectPhrase: 'grantTypeSubject',
    description: 'grantTypeDescription',
  },
  pb: {
    label: 'pbTypeLabel',
    subjectPhrase: 'pbTypeSubject',
    description: 'pbTypeDescription',
  },
  other: {
    label: 'otherTypeLabel',
    subjectPhrase: 'otherTypeSubject',
    description: 'otherTypeDescription',
  },
};

export const TYPE_OPTIONS: Choice<ProcessType>[] = TYPE_ORDER.map((type) => ({
  key: type,
  label: TYPE_META[type].label,
  description: TYPE_META[type].description,
}));

export interface ShapeQuestion {
  heading: WizardCopyKey;
  options: Choice<ShapeKey>[];
}

/** The other pathway composes its shape from its questions instead. */
export const SHAPE_QUESTION: Record<
  Exclude<ProcessType, 'other'>,
  ShapeQuestion
> = {
  grant: {
    heading: 'grantShapeHeading',
    options: [
      {
        key: 'single',
        label: 'grantShapeSingleLabel',
        description: 'grantShapeSingleDescription',
      },
      {
        key: 'loi',
        label: 'grantShapeLoiLabel',
        description: 'grantShapeLoiDescription',
      },
    ],
  },
  pb: {
    heading: 'pbShapeHeading',
    options: [
      {
        key: 'ideas',
        label: 'pbShapeIdeasLabel',
        description: 'pbShapeIdeasDescription',
      },
      {
        key: 'proposals',
        label: 'pbShapeProposalsLabel',
        description: 'pbShapeProposalsDescription',
      },
    ],
  },
};

type PieceSetKey = `grant:${GrantShape}` | `pb:${PbShape}`;

const PIECE_SETS: Record<PieceSetKey, ProcessPiece[]> = {
  'pb:ideas': [
    {
      name: 'collectIdeas',
      phaseName: 'shareYourIdeas',
      phaseType: 'submissions',
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
      phaseType: 'review',
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
      phaseType: 'submissions',
      description: 'buildProposalsDescription',
      capabilities: [
        'chooseWhoDevelopsThem',
        'setWhatProposalMustInclude',
        'addCostBudgetDetails',
      ],
    },
    {
      name: 'putVote',
      phaseName: 'votePhase',
      phaseType: 'voting',
      capabilities: [
        'chooseHowPeopleVote',
        'setBudgetLimits',
        'decideWhoCanVote',
      ],
      norm: 'pbVoteNorm',
    },
    {
      name: 'shareResults',
      phaseName: 'seeResults',
      phaseType: 'results',
      capabilities: [
        'publishWhatGotFunded',
        'notifyParticipants',
        'shareSummaryPage',
      ],
    },
  ],

  'pb:proposals': [
    {
      name: 'collectProposals',
      phaseName: 'sendYourProposals',
      phaseType: 'submissions',
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
      phaseType: 'review',
      capabilities: [
        'checkEligibilityFeasibility',
        'addQuestionsReviewers',
        'runMoreThanOneRound',
      ],
    },
    {
      name: 'putVote',
      phaseName: 'votePhase',
      phaseType: 'voting',
      capabilities: [
        'chooseHowPeopleVote',
        'setBudgetLimits',
        'decideWhoCanVote',
      ],
      norm: 'pbVoteNorm',
    },
    {
      name: 'shareResults',
      phaseName: 'seeResults',
      phaseType: 'results',
      capabilities: [
        'publishWhatGotFunded',
        'notifyParticipants',
        'shareSummaryPage',
      ],
    },
  ],

  'grant:loi': [
    {
      name: 'collectLettersIntent',
      phaseName: 'sendLetterIntent',
      phaseType: 'submissions',
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
      phaseType: 'review',
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
      phaseType: 'submissions',
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
      phaseType: 'review',
      description: 'chooseFromFullApplicationsDescription',
      capabilities: [
        'buildScoringRubric',
        'inviteReviewers',
        'runMoreThanOneRound',
        'chooseWhatAdvances',
      ],
    },
    {
      name: 'shareAwards',
      phaseName: 'seeAwards',
      phaseType: 'results',
      capabilities: ['publishAwards', 'notifyApplicants', 'shareSummaryPage'],
    },
  ],

  'grant:single': [
    {
      name: 'collectApplications',
      phaseName: 'sendYourApplication',
      phaseType: 'submissions',
      capabilities: [
        'setWhatApplicationAsks',
        'openAllInviteOnly',
        'addDeadline',
      ],
    },
    {
      name: 'chooseWhosFunded',
      phaseName: 'reviewDecide',
      phaseType: 'review',
      description: 'chooseFromApplicationsDescription',
      capabilities: [
        'buildScoringRubric',
        'addQuestionsReviewers',
        'inviteReviewers',
        'chooseWhatAdvances',
      ],
    },
    {
      name: 'shareAwards',
      phaseName: 'seeAwards',
      phaseType: 'results',
      capabilities: ['publishAwards', 'notifyApplicants', 'shareSummaryPage'],
    },
  ],
};

const isPieceSetKey = (key: string): key is PieceSetKey => key in PIECE_SETS;

export function piecesFor(
  type: ProcessType | null,
  shape: ShapeKey | null,
): ProcessPiece[] {
  if (!type || !shape) {
    return [];
  }

  const key = `${type}:${shape}`;

  return isPieceSetKey(key) ? PIECE_SETS[key] : [];
}

export const GRANT_DECISION_QUESTION: {
  heading: WizardCopyKey;
  options: Choice<GrantDecision>[];
} = {
  heading: 'grantDecisionHeading',
  options: [
    {
      key: 'rubric',
      label: 'grantDecisionRubricLabel',
      description: 'grantDecisionRubricDescription',
    },
    {
      key: 'applicants',
      label: 'grantDecisionApplicantsLabel',
      description: 'grantDecisionApplicantsDescription',
    },
    {
      key: 'hybrid',
      label: 'grantDecisionHybridLabel',
      description: 'grantDecisionHybridDescription',
    },
  ],
};

const GRANT_VOTE_PIECE: ProcessPiece = {
  name: 'putVote',
  phaseName: 'votePhase',
  phaseType: 'voting',
  description: 'grantVoteDescription',
  capabilities: [
    'chooseHowPeopleVote',
    'combineWaysVoting',
    'decideWhoCanVote',
    'keepVotesAnonymous',
  ],
};

/** Only the last review changes: an earlier one picks who advances, whoever decides. */
export function applyGrantDecision(
  pieces: ProcessPiece[],
  decision: GrantDecision | null,
): ProcessPiece[] {
  if (!decision || decision === 'rubric' || pieces.length === 0) {
    return pieces;
  }

  const lastReview = pieces.map((p) => p.phaseType).lastIndexOf('review');

  if (lastReview < 0) {
    return pieces;
  }

  if (decision === 'applicants') {
    return pieces.map((p, i) => (i === lastReview ? GRANT_VOTE_PIECE : p));
  }

  const deciding = pieces[lastReview];

  if (!deciding) {
    return pieces;
  }

  const narrowed: ProcessPiece = {
    ...deciding,
    name: 'narrowField',
    phaseName: 'pickFinalists',
    description: 'narrowFieldDescription',
  };

  return [
    ...pieces.slice(0, lastReview),
    narrowed,
    GRANT_VOTE_PIECE,
    ...pieces.slice(lastReview + 1),
  ];
}
