import type {
  Choice,
  GrantShape,
  OtherShape,
  PbShape,
  PhaseType,
  ProcessPiece,
  ProcessType,
  ShapeKey,
  WizardCopyKey,
} from './types';

/**
 * Fixed content for the wizard: type labels, the one shape question per type,
 * and the phase mapping each pair resolves to. "Other" composes its own — see
 * `otherFlow.ts`.
 */

/** The name bounds `createInstanceFromTemplate` will take. */
export const MIN_PROCESS_NAME_LENGTH = 3;
export const MAX_PROCESS_NAME_LENGTH = 256;

export const PHASE_TYPE_LABEL: Record<PhaseType, WizardCopyKey> = {
  submissions: 'submissionsPhase',
  review: 'reviewPhase',
  develop: 'developPhase',
  voting: 'votingPhase',
  results: 'resultsPhase',
};

export interface TypeMeta {
  label: WizardCopyKey;
  /** A whole noun phrase, not an interpolated adjective — articles inflect. */
  subjectPhrase: WizardCopyKey;
  description: WizardCopyKey;
}

/** Order is the order the cards appear in. */
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

export interface ShapeQuestion {
  heading: WizardCopyKey;
  options: Choice<ShapeKey>[];
}

/** The one shape follow-up, per type. "Other" asks its own questions instead. */
export const SHAPE_QUESTION: Partial<Record<ProcessType, ShapeQuestion>> = {
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

/**
 * Every (type, shape) pair the wizard can reach. Spelled out as a total
 * `Record` rather than a string lookup: a new shape has to be given a mapping
 * here or `typecheck` fails, instead of resolving to nothing at runtime and
 * producing a process with no phases.
 *
 * The two `other` pairs map to nothing on purpose — `custom` composes its
 * mapping in `otherFlow.ts`, and `blank` is the escape hatch that asks for a
 * name and builds no phases at all.
 */
type PieceSetKey =
  | `grant:${GrantShape}`
  | `pb:${PbShape}`
  | `other:${OtherShape}`;

const PIECE_SETS: Record<PieceSetKey, ProcessPiece[]> = {
  'other:custom': [],
  'other:blank': [],

  // Participatory budgeting — rough ideas first.
  'pb:ideas': [
    {
      name: 'collectIdeas',
      phaseName: 'shareYourIdeas',
      phaseType: 'submissions',
      description: 'keptLightSoAnyoneCan',
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
      description: 'yourTeamsFirstPassOver',
      capabilities: [
        'checkEligibilityFeasibility',
        'mergeGroupDuplicates',
        'addQuestionsReviewers',
        'runMoreThanOneRound',
      ],
    },
    {
      name: 'buildProposals',
      phaseName: 'buildProposalsPhase',
      phaseType: 'develop',
      description: 'strongestIdeasBecomeFullCosted',
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
      norm: 'mostPbLetsPeopleSpread',
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

  // Participatory budgeting — complete proposals from the start.
  'pb:proposals': [
    {
      name: 'collectProposals',
      phaseName: 'sendYourProposals',
      phaseType: 'submissions',
      description: 'peopleSubmitCompleteProposalsReady',
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
      norm: 'mostPbLetsPeopleSpread',
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

  // Grantmaking — a letter of intent first, then full applications.
  'grant:loi': [
    {
      name: 'collectLettersIntent',
      phaseName: 'sendLetterIntent',
      phaseType: 'submissions',
      description: 'shortLetterFirstGistNothing',
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
      description: 'panelReviewsLettersInvitesShortlist',
      capabilities: [
        'buildScoringRubric',
        'addQuestionsReviewers',
        'inviteReviewers',
        'chooseWhatAdvances',
      ],
    },
    {
      // A process collects once. The full application isn't a second intake —
      // it's the shortlist developing what they already sent in.
      name: 'collectFullApplications',
      phaseName: 'sendYourApplication',
      phaseType: 'develop',
      description: 'shortlistDevelopsTheirLetterInto',
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
      description: 'panelReviewsFullApplicationsDecides',
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

  // Grantmaking — one full application, reviewed as is.
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
      description: 'panelReviewsApplicationsDecides',
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

/**
 * The pieces for a chosen (type, shape). Empty for a pair that maps to nothing,
 * and for a half-answered one — the shape question has not been reached yet.
 */
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

/** Grantmaking — who actually makes the call. */
export type GrantDecision = 'rubric' | 'applicants' | 'hybrid';

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
  phaseType: 'voting',
  description: 'peopleInvitedVoteDecideWhere',
  capabilities: [
    'chooseHowPeopleVote',
    'combineWaysVoting',
    'decideWhoCanVote',
    'keepVotesAnonymous',
  ],
};

/**
 * Reshape a grantmaking set around who decides. Only the *last* review changes:
 * an earlier one picks who advances, which happens either way.
 */
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
    // No deciding panel at all — the applicants vote instead.
    return pieces.map((p, i) => (i === lastReview ? GRANT_VOTE_PIECE : p));
  }

  const deciding = pieces[lastReview];

  if (!deciding) {
    return pieces;
  }

  // Hybrid — the panel narrows the field, then the vote settles it.
  const narrowed: ProcessPiece = {
    ...deciding,
    name: 'narrowField',
    description: 'reviewersScoreWhatCamePick',
  };

  return [
    ...pieces.slice(0, lastReview),
    narrowed,
    GRANT_VOTE_PIECE,
    ...pieces.slice(lastReview + 1),
  ];
}
