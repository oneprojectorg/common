import type { TranslateFn, TranslationKey } from '@/lib/i18n';

import type { Choice, ProcessPiece } from './types';

/**
 * The "other process" pathway — four plain-language questions instead of a
 * free-text box. Each answer narrows what Common would actually build, so by
 * the end there is a real phase mapping rather than a guess at one.
 *
 * Nothing a participant reads here uses Common's internal vocabulary: people
 * answer about their own process, and the mapping onto submissions / review /
 * develop / voting / results happens at the bottom of this file.
 */

/** Q1 — what the process decides on. */
export type Subject = 'funding' | 'ideas' | 'people' | 'else';

/** Q2 — whether it runs to an end or stays open. */
export type Cadence = 'timeline' | 'ongoing';

/** Q3 — what arrives first. `none` means nothing is submitted. */
export type SubmitKey =
  | 'applications'
  | 'proposals'
  | 'rough'
  | 'nominations'
  | 'none';

/** Q4 — how the call gets made. */
export type Decision = 'vote' | 'review' | 'both' | 'agree';

export interface OtherAnswers {
  subjects: Subject[];
  /** Free text, only when "Something else" is one of the subjects. */
  elseText: string;
  /** Which subject to set up first, when more than one was picked. */
  focus: Subject | null;
  cadence: Cadence | null;
  submits: SubmitKey | null;
  decision: Decision | null;
}

export const EMPTY_OTHER: OtherAnswers = {
  subjects: [],
  elseText: '',
  focus: null,
  cadence: null,
  submits: null,
  decision: null,
};

/** The screens this pathway can show, in order. */
export type OtherStep =
  | 'subjects'
  | 'cadence'
  | 'focus'
  | 'submits'
  | 'decision';

// --- Q1 ---------------------------------------------------------------------

export const SUBJECT_OPTIONS: Choice<Subject>[] = [
  {
    key: 'funding',
    label: 'Funding',
    description: 'Money going to projects, organisations, or ideas',
  },
  {
    key: 'ideas',
    label: 'Ideas or priorities',
    description: 'What to focus on or do next',
  },
  {
    key: 'people',
    label: 'People',
    description: 'Electing or selecting someone for a role',
  },
  {
    key: 'else',
    label: 'Something else',
    description: 'Tell us in a few words',
  },
];

/** Short noun for a subject, for use inside a sentence. */
const SUBJECT_NOUN: Record<Subject, TranslationKey> = {
  funding: 'funding',
  ideas: 'ideas and priorities',
  people: 'people for a role',
  else: 'this',
};

// --- Q2 ---------------------------------------------------------------------

export const CADENCE_OPTIONS: Choice<Cadence>[] = [
  {
    key: 'timeline',
    label: 'It has a timeline',
    description: 'Opens, moves through stages, wraps up',
  },
  {
    key: 'ongoing',
    label: "It's always open",
    description: 'Things come up and get decided as they go',
  },
];

// --- Q3 ---------------------------------------------------------------------

/**
 * What comes in first, worded for what they are deciding on. The last option is
 * always "nothing" — some groups decide on something that already exists, and
 * that skips the intake entirely.
 */
export const SUBMIT_OPTIONS: Record<Subject, Choice<SubmitKey>[]> = {
  funding: [
    {
      key: 'applications',
      label: 'Full applications',
      description: 'Ready to assess as they arrive',
    },
    {
      key: 'rough',
      label: 'Rough ideas first',
      description: 'The strongest get worked up into full proposals later',
    },
    {
      key: 'none',
      label: 'Nothing is submitted',
      description: "We're deciding on things that already exist",
    },
  ],
  ideas: [
    {
      key: 'rough',
      label: 'Rough ideas',
      description: 'The ones with support get worked up later',
    },
    {
      key: 'proposals',
      label: 'Worked-up proposals',
      description: 'Ready to weigh in on as they arrive',
    },
    {
      key: 'none',
      label: 'Nothing is submitted',
      description: "We're deciding between options we already have",
    },
  ],
  people: [
    {
      key: 'nominations',
      label: 'Nominations',
      description: 'People put names forward, including their own',
    },
    {
      key: 'applications',
      label: 'Applications from candidates',
      description: 'Candidates make their own case',
    },
    {
      key: 'none',
      label: 'Nothing is submitted',
      description: 'The candidates are already set',
    },
  ],
  else: [
    {
      key: 'proposals',
      label: 'Written submissions',
      description: 'Ready to weigh in on as they arrive',
    },
    {
      key: 'rough',
      label: 'Rough ideas first',
      description: 'The strongest get worked up later',
    },
    {
      key: 'none',
      label: 'Nothing is submitted',
      description: "We're deciding on something that already exists",
    },
  ],
};

/** The Q3 heading, worded for the subject. */
export const SUBMIT_HEADING: Record<Subject, TranslationKey> = {
  funding: 'What do people send in first?',
  ideas: 'What do people put forward first?',
  people: 'How do candidates come forward?',
  else: 'What do people put forward first?',
};

// --- Q4 ---------------------------------------------------------------------

export const DECISION_OPTIONS: Choice<Decision>[] = [
  {
    key: 'vote',
    label: 'Everyone votes',
    description: 'The whole group decides together',
  },
  {
    key: 'review',
    label: 'A smaller group reviews and decides',
    description: 'A panel or committee makes the call',
  },
  {
    key: 'both',
    label: 'Both',
    description: 'A review narrows it down, then it goes to a vote',
  },
  {
    key: 'agree',
    label: 'We discuss until we agree',
    description: 'No formal vote — support shows through comments and likes',
  },
];

// --- Sequencing -------------------------------------------------------------

/**
 * Which screens this person sees. Picking several subjects only forces a choice
 * when the process has an end: a run with stages can only be about one thing at
 * a time, while an always-open space happily covers all of them at once — so
 * the focus screen sits after the timeline question, not before it.
 */
export function otherStepList(answers: OtherAnswers): OtherStep[] {
  const needsFocus =
    answers.subjects.length > 1 && answers.cadence === 'timeline';
  // Declared rather than asserted: an inline `['focus']` in a spread widens to
  // `string[]`, and the repo does not use type assertions to paper over that.
  const focusStep: OtherStep[] = needsFocus ? ['focus'] : [];

  return ['subjects', 'cadence', ...focusStep, 'submits', 'decision'];
}

/** Whether the current screen has enough of an answer to move on. */
export function otherCanContinue(
  step: OtherStep,
  answers: OtherAnswers,
): boolean {
  switch (step) {
    case 'subjects':
      return (
        answers.subjects.length > 0 &&
        (!answers.subjects.includes('else') ||
          answers.elseText.trim().length > 0)
      );
    case 'focus':
      return !!answers.focus;
    case 'cadence':
      return !!answers.cadence;
    case 'submits':
      return !!answers.submits;
    case 'decision':
      return !!answers.decision;
  }
}

/**
 * The subject driving the wording from here on. A timeline process has picked
 * one; an always-open space can cover several at once, and there is no single
 * subject to speak from — so it falls back to the general wording.
 */
export function activeSubject(answers: OtherAnswers): Subject {
  if (answers.focus) {
    return answers.focus;
  }

  const [only] = answers.subjects;

  if (answers.subjects.length === 1 && only) {
    return only;
  }

  return 'else';
}

/**
 * How to name what is being decided, inside a sentence. Lists them all when an
 * always-open space covers more than one.
 */
export function subjectPhrase(
  answers: OtherAnswers,
  t: TranslateFn,
  locale: string,
): string {
  // "Something else" speaks in the user's own words, untranslated.
  const named = (subject: Subject) =>
    subject === 'else' && answers.elseText.trim()
      ? answers.elseText.trim()
      : t(SUBJECT_NOUN[subject]);

  if (answers.focus) {
    return named(answers.focus);
  }

  const [only] = answers.subjects;

  if (answers.subjects.length === 1 && only) {
    return named(only);
  }

  if (answers.subjects.length === 0) {
    return t(SUBJECT_NOUN.else);
  }

  return new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  }).format(answers.subjects.map(named));
}

// --- Answers → phases -------------------------------------------------------

const INTAKE_NAME: Record<SubmitKey, TranslationKey> = {
  applications: 'Collect applications',
  proposals: 'Collect proposals',
  rough: 'Collect ideas',
  nominations: 'Collect nominations',
  none: 'Collect submissions',
};

/** The same phases, named for the people who will read them on the timeline. */
const INTAKE_PHASE_NAME: Record<SubmitKey, TranslationKey> = {
  applications: 'Send in your application',
  proposals: 'Send in your proposal',
  rough: 'Share your ideas',
  nominations: 'Make a nomination',
  none: 'Send in your submission',
};

const INTAKE_DESCRIPTION: Record<SubmitKey, TranslationKey> = {
  applications: 'Gather full applications from anyone taking part.',
  proposals: 'Gather written proposals from anyone taking part.',
  rough: 'Kept light so anyone can take part.',
  nominations: 'Gather the names people put forward.',
  none: 'Gather what people put forward.',
};

/**
 * Build the phase mapping from the answers. The order follows how these run in
 * practice: intake, then a review that narrows, then developing what survived,
 * then the decision, then publishing it.
 */
export function composeOtherPieces(answers: OtherAnswers): ProcessPiece[] {
  const subject = activeSubject(answers);
  const submits = answers.submits ?? 'none';
  const decision = answers.decision ?? 'vote';
  const discussionOnly = decision === 'agree';

  // Always open — one intake that never closes, and support shown in the open.
  if (answers.cadence === 'ongoing') {
    const votingCapabilities: TranslationKey[] =
      decision === 'vote' || decision === 'both'
        ? ['Run a vote on an item when you need one']
        : [];

    return [
      {
        name: INTAKE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseName:
          INTAKE_PHASE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseType: 'submissions',
        description: 'Stays open. Members post whenever something comes up.',
        capabilities: [
          'Set your own questions',
          'Invite your group',
          'Let members comment and like to show support',
          ...votingCapabilities,
          'No closing date — it runs as long as you need',
        ],
        norm: 'Most groups running this way keep it invite-only, so it stays their space.',
      },
    ];
  }

  const pieces: ProcessPiece[] = [];

  if (submits !== 'none') {
    // Without a formal vote, support has to show somewhere — so the intake
    // itself carries the commenting and liking.
    const supportCapabilities: TranslationKey[] = discussionOnly
      ? ['Let people comment and like to show support']
      : [];

    pieces.push({
      name: INTAKE_NAME[submits],
      phaseName: INTAKE_PHASE_NAME[submits],
      phaseType: 'submissions',
      description: INTAKE_DESCRIPTION[submits],
      capabilities: [
        'Set your own questions',
        'Open to all or invite-only',
        'Add a deadline',
        ...supportCapabilities,
      ],
    });
  }

  if (decision === 'review' || decision === 'both') {
    pieces.push({
      name: decision === 'both' ? 'Narrow it down' : 'Review and decide',
      phaseName: decision === 'both' ? 'Shortlisting' : 'Review and decide',
      phaseType: 'review',
      description:
        decision === 'both'
          ? 'A smaller group scores what came in and picks what goes to the vote.'
          : 'A smaller group scores what came in and makes the call.',
      capabilities: [
        'Build a scoring rubric',
        'Invite the reviewers',
        'Score blind if you want to',
        'Choose what advances',
      ],
    });
  }

  if (submits === 'rough') {
    pieces.push({
      name: 'Work them up',
      phaseName: 'Build them up',
      phaseType: 'develop',
      description: 'What advances gets built into something fuller.',
      capabilities: [
        'Build on what was already submitted',
        'Add questions for the fuller version',
        'Set a deadline',
      ],
    });
  }

  if (decision === 'vote' || decision === 'both') {
    pieces.push({
      name: subject === 'people' ? 'Hold the vote' : 'Put it to a vote',
      phaseName: 'Vote',
      phaseType: 'voting',
      description: 'Everyone taking part decides together.',
      capabilities: [
        'Choose how people vote',
        'Combine ways of voting',
        'Decide who can vote',
        'Keep votes anonymous',
      ],
    });
  }

  pieces.push({
    name: 'Share what was decided',
    phaseName: 'See what was decided',
    phaseType: 'results',
    capabilities: [
      discussionOnly
        ? 'Publish what the group landed on'
        : 'Publish the outcome',
      'Show titles only, or the full entries',
      'Notify everyone who took part',
    ],
  });

  return pieces;
}

const INTAKE_RECAP: Record<SubmitKey, TranslationKey> = {
  none: 'nothing to collect first',
  rough: 'rough ideas first, worked up later',
  nominations: 'nominations first',
  applications: 'applications first',
  proposals: 'written submissions first',
};

const DECISION_RECAP: Record<Decision, TranslationKey> = {
  vote: 'everyone votes',
  review: 'a smaller group decides',
  both: 'a review narrows it down, then everyone votes',
  agree: 'you discuss until you agree',
};

/** A plain-language recap, shown above the mapping on the walkthrough screen. */
export function describeOther(
  answers: OtherAnswers,
  t: TranslateFn,
  locale: string,
): string {
  const subject = subjectPhrase(answers, t, locale);

  if (answers.cadence === 'ongoing') {
    return t(
      'Deciding on {subject}, always open, just for your group — members post as things come up and support shows through comments and likes.',
      { subject },
    );
  }

  return t('Deciding on {subject}, start to finish: {intake}, and {call}.', {
    subject,
    intake: t(INTAKE_RECAP[answers.submits ?? 'none']),
    call: t(DECISION_RECAP[answers.decision ?? 'vote']),
  });
}
