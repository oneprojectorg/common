import type { TranslationKey } from '@/lib/i18n';

import type {
  Choice,
  GrantShape,
  OtherShape,
  PbShape,
  PhaseType,
  ProcessPiece,
  ProcessType,
  ShapeKey,
} from './types';

/**
 * Fixed content for the wizard: type labels, the one shape question per type,
 * and the phase mapping each pair resolves to. "Other" composes its own — see
 * `otherFlow.ts`.
 */

/** The name bounds `createInstanceFromTemplate` will take. */
export const MIN_PROCESS_NAME_LENGTH = 3;
export const MAX_PROCESS_NAME_LENGTH = 256;

export const PHASE_TYPE_LABEL: Record<PhaseType, TranslationKey> = {
  submissions: 'Submissions',
  review: 'Review',
  develop: 'Develop',
  voting: 'Voting',
  results: 'Results',
};

export interface TypeMeta {
  label: TranslationKey;
  /** A whole noun phrase, not an interpolated adjective — articles inflect. */
  subjectPhrase: TranslationKey;
  description: TranslationKey;
}

/** Order is the order the cards appear in. */
export const TYPE_ORDER: ProcessType[] = ['grant', 'pb', 'other'];

export const TYPE_META: Record<ProcessType, TypeMeta> = {
  grant: {
    label: 'Participatory grantmaking',
    subjectPhrase: 'a participatory grantmaking process',
    description: 'Awarding funds to applicants',
  },
  pb: {
    label: 'Participatory budgeting',
    subjectPhrase: 'a participatory budgeting process',
    description: 'A group decides how to spend a budget',
  },
  other: {
    label: 'Other process type',
    subjectPhrase: 'your process',
    description: "Answer a few questions and we'll map it onto Common",
  },
};

export interface ShapeQuestion {
  heading: TranslationKey;
  options: Choice<ShapeKey>[];
}

/** The one shape follow-up, per type. "Other" asks its own questions instead. */
export const SHAPE_QUESTION: Partial<Record<ProcessType, ShapeQuestion>> = {
  grant: {
    heading: 'How do applications come in?',
    options: [
      {
        key: 'single',
        label: 'One full application',
        description: 'Submitted once, reviewed as is',
      },
      {
        key: 'loi',
        label: 'A letter of intent first',
        description: 'Then a full application if they advance',
      },
    ],
  },
  pb: {
    heading: 'What do people submit first?',
    options: [
      {
        key: 'ideas',
        label: 'Rough ideas',
        description: 'The strongest get developed into full proposals later',
      },
      {
        key: 'proposals',
        label: 'Complete proposals',
        description: 'Ready to review as they are',
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
      name: 'Collect ideas',
      phaseName: 'Share your ideas',
      phaseType: 'submissions',
      description: 'Kept light so anyone can take part.',
      capabilities: [
        'Set your own questions',
        'Open to all or invite-only',
        'Add a deadline or run on a timer',
      ],
    },
    {
      name: 'Screen the ideas',
      phaseName: 'Review the ideas',
      phaseType: 'review',
      description: "Your team's first pass over what came in.",
      capabilities: [
        'Check eligibility and feasibility',
        'Merge or group duplicates',
        'Add questions for reviewers',
        'Run more than one round of review',
      ],
    },
    {
      name: 'Build proposals',
      phaseName: 'Build the proposals',
      phaseType: 'develop',
      description: 'The strongest ideas become full, costed proposals.',
      capabilities: [
        'Choose who develops them',
        'Set what a proposal must include',
        'Add cost or budget details',
      ],
    },
    {
      name: 'Put it to a vote',
      phaseName: 'Vote',
      phaseType: 'voting',
      capabilities: [
        'Choose how people vote',
        'Set the budget and limits',
        'Decide who can vote',
      ],
      norm: 'Most PB lets people spread a budget across projects.',
    },
    {
      name: 'Share results',
      phaseName: 'See the results',
      phaseType: 'results',
      capabilities: [
        'Publish what got funded',
        'Notify participants',
        'Share a summary page',
      ],
    },
  ],

  // Participatory budgeting — complete proposals from the start.
  'pb:proposals': [
    {
      name: 'Collect proposals',
      phaseName: 'Send in your proposals',
      phaseType: 'submissions',
      description: 'People submit complete proposals, ready to review.',
      capabilities: [
        'Set your own questions',
        'Open to all or invite-only',
        'Add a deadline or run on a timer',
      ],
    },
    {
      name: 'Screen the proposals',
      phaseName: 'Review the proposals',
      phaseType: 'review',
      capabilities: [
        'Check eligibility and feasibility',
        'Add questions for reviewers',
        'Run more than one round of review',
      ],
    },
    {
      name: 'Put it to a vote',
      phaseName: 'Vote',
      phaseType: 'voting',
      capabilities: [
        'Choose how people vote',
        'Set the budget and limits',
        'Decide who can vote',
      ],
      norm: 'Most PB lets people spread a budget across projects.',
    },
    {
      name: 'Share results',
      phaseName: 'See the results',
      phaseType: 'results',
      capabilities: [
        'Publish what got funded',
        'Notify participants',
        'Share a summary page',
      ],
    },
  ],

  // Grantmaking — a letter of intent first, then full applications.
  'grant:loi': [
    {
      name: 'Collect letters of intent',
      phaseName: 'Send a letter of intent',
      phaseType: 'submissions',
      description: 'A short letter first — the gist, nothing exhaustive.',
      capabilities: [
        'Set what the letter should cover',
        'Open to all or invite-only',
        'Add a deadline',
      ],
    },
    {
      name: 'Pick a shortlist',
      phaseName: 'Shortlisting',
      phaseType: 'review',
      description: 'A panel reviews the letters and invites a shortlist.',
      capabilities: [
        'Build a scoring rubric',
        'Add questions for reviewers',
        'Invite reviewers',
        'Choose what advances',
      ],
    },
    {
      // A process collects once. The full application isn't a second intake —
      // it's the shortlist developing what they already sent in.
      name: 'Collect full applications',
      phaseName: 'Send in your application',
      phaseType: 'develop',
      description:
        'The shortlist develops their letter into a full application.',
      capabilities: [
        'Build on what the letter asked',
        'Add questions for the full application',
        'Add a deadline',
      ],
    },
    {
      name: "Choose who's funded",
      phaseName: 'Review and decide',
      phaseType: 'review',
      description: 'The panel reviews full applications and decides.',
      capabilities: [
        'Build a scoring rubric',
        'Invite reviewers',
        'Run more than one round of review',
        'Choose what advances',
      ],
    },
    {
      name: 'Share the awards',
      phaseName: 'See the awards',
      phaseType: 'results',
      capabilities: [
        'Publish the awards',
        'Notify applicants',
        'Share a summary page',
      ],
    },
  ],

  // Grantmaking — one full application, reviewed as is.
  'grant:single': [
    {
      name: 'Collect applications',
      phaseName: 'Send in your application',
      phaseType: 'submissions',
      capabilities: [
        'Set what the application asks',
        'Open to all or invite-only',
        'Add a deadline',
      ],
    },
    {
      name: "Choose who's funded",
      phaseName: 'Review and decide',
      phaseType: 'review',
      description: 'A panel reviews applications and decides.',
      capabilities: [
        'Build a scoring rubric',
        'Add questions for reviewers',
        'Invite reviewers',
        'Choose what advances',
      ],
    },
    {
      name: 'Share the awards',
      phaseName: 'See the awards',
      phaseType: 'results',
      capabilities: [
        'Publish the awards',
        'Notify applicants',
        'Share a summary page',
      ],
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
  heading: TranslationKey;
  options: Choice<GrantDecision>[];
} = {
  heading: 'Who decides what gets funded?',
  options: [
    {
      key: 'rubric',
      label: 'Reviewers score against a rubric',
      description: 'A panel assesses each application and makes the call',
    },
    {
      key: 'applicants',
      label: 'The applicants vote',
      description: 'Everyone who applied helps decide where the money goes',
    },
    {
      key: 'hybrid',
      label: 'Reviewers shortlist, then a vote decides',
      description: 'A panel narrows the field, then it goes to a vote',
    },
  ],
};

const GRANT_VOTE_PIECE: ProcessPiece = {
  name: 'Put it to a vote',
  phaseType: 'voting',
  description: 'The people invited to vote decide where the money goes.',
  capabilities: [
    'Choose how people vote',
    'Combine ways of voting',
    'Decide who can vote',
    'Keep votes anonymous',
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
    name: 'Narrow the field',
    description: 'Reviewers score what came in and pick the finalists.',
  };

  return [
    ...pieces.slice(0, lastReview),
    narrowed,
    GRANT_VOTE_PIECE,
    ...pieces.slice(lastReview + 1),
  ];
}
