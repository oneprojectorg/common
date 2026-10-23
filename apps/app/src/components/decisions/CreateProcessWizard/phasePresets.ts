// What the wizard offers for a named type and shape: hand-written phase lists, and the grant transform. Read by the mapping step.
import type {
  GrantDecision,
  GrantShape,
  PbShape,
  ProcessPiece,
  ProcessType,
  ShapeKey,
} from './types';

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
