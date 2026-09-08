import type { ComponentType } from 'react';
import {
  LuClipboardCheck,
  LuHandCoins,
  LuInbox,
  LuPenTool,
  LuShapes,
  LuTrophy,
  LuUsers,
  LuVote,
} from 'react-icons/lu';

import type { TranslationKey } from '@/lib/i18n';

import type {
  Choice,
  PhaseType,
  ProcessPiece,
  ProcessType,
  ShapeKey,
} from './types';

/**
 * Fixed content for the wizard: what a process type is called, the one shape
 * question per type, and the phase mapping each (type, shape) pair resolves to.
 * The "other" pathway composes its own mapping — see `otherFlow.ts`.
 */

type IconComponent = ComponentType<{ className?: string }>;

/**
 * The shortest name the API will take (`createInstanceFromTemplate`). The
 * wizard can't hand over a nameless process, so the last step holds until this
 * is met rather than inventing a placeholder title.
 */
export const MIN_PROCESS_NAME_LENGTH = 3;

/**
 * One icon per phase type, used by the mapping step and (from slice 2) the
 * process page, so a piece reads as the same thing on both sides of the
 * hand-off.
 */
export const PHASE_TYPE_ICON: Record<PhaseType, IconComponent> = {
  submissions: LuInbox,
  review: LuClipboardCheck,
  develop: LuPenTool,
  voting: LuVote,
  results: LuTrophy,
};

export const PHASE_TYPE_LABEL: Record<PhaseType, TranslationKey> = {
  submissions: 'Submissions',
  review: 'Review',
  develop: 'Develop',
  voting: 'Voting',
  results: 'Results',
};

export interface TypeMeta {
  label: TranslationKey;
  /**
   * The subject of the mapping step's headline, as a whole noun phrase —
   * "Here's how *a participatory budgeting process* could run on Common".
   * A phrase rather than an interpolated adjective, because languages that
   * inflect the article can't build one from parts.
   */
  subjectPhrase: TranslationKey;
  description: TranslationKey;
  icon: IconComponent;
}

/** Order is the order the cards appear in. */
export const TYPE_ORDER: ProcessType[] = ['grant', 'pb', 'other'];

export const TYPE_META: Record<ProcessType, TypeMeta> = {
  grant: {
    label: 'Participatory grantmaking',
    subjectPhrase: 'a participatory grantmaking process',
    description: 'Awarding funds to applicants',
    icon: LuHandCoins,
  },
  pb: {
    label: 'Participatory budgeting',
    subjectPhrase: 'a participatory budgeting process',
    description: 'A group decides how to spend a budget',
    icon: LuUsers,
  },
  other: {
    label: 'Other process type',
    subjectPhrase: 'your process',
    description: "Answer a few questions and we'll map it onto Common",
    icon: LuShapes,
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

/** The piece sets, keyed `type:shape`. */
const PIECE_SETS: Record<string, ProcessPiece[]> = {
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

/** The pieces for a chosen (type, shape). Empty for an unmapped combination. */
export function piecesFor(
  type: ProcessType | null,
  shape: ShapeKey | null,
): ProcessPiece[] {
  if (!type || !shape) {
    return [];
  }

  return PIECE_SETS[`${type}:${shape}`] ?? [];
}

/**
 * Grantmaking — who actually makes the call.
 *
 * A panel scoring against a rubric is the common case but not the only one:
 * plenty of funds hand the decision to the applicants themselves, or use a
 * panel to shortlist and then vote. That changes the phases, so it is a
 * question rather than an assumption.
 */
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
 * in a letter-of-intent process the earlier review picks who advances, which
 * happens either way.
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
