import type { TranslateFn } from '@/lib/i18n';

import type { Choice, ProcessPiece, WizardCopyKey } from './types';

/**
 * The "other process" pathway — four plain-language questions instead of a
 * free-text box, composed into a real phase mapping at the bottom of the file.
 * None of the copy here uses Common's internal vocabulary.
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
  /** Free text, only when 'subjectElseLabel' is one of the subjects. */
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
    label: 'subjectFundingLabel',
    description: 'subjectFundingDescription',
  },
  {
    key: 'ideas',
    label: 'subjectIdeasLabel',
    description: 'subjectIdeasDescription',
  },
  {
    key: 'people',
    label: 'subjectPeopleLabel',
    description: 'subjectPeopleDescription',
  },
  {
    key: 'else',
    label: 'subjectElseLabel',
    description: 'subjectElseDescription',
  },
];

/** Short noun for a subject, for use inside a sentence. */
const SUBJECT_NOUN: Record<Subject, WizardCopyKey> = {
  funding: 'subjectFundingNoun',
  ideas: 'subjectIdeasNoun',
  people: 'subjectPeopleNoun',
  else: 'subjectElseNoun',
};

// --- Q2 ---------------------------------------------------------------------

export const CADENCE_OPTIONS: Choice<Cadence>[] = [
  {
    key: 'timeline',
    label: 'cadenceTimelineLabel',
    description: 'cadenceTimelineDescription',
  },
  {
    key: 'ongoing',
    label: 'cadenceOngoingLabel',
    description: 'cadenceOngoingDescription',
  },
];

// --- Q3 ---------------------------------------------------------------------

/** Worded per subject. The last option always skips the intake entirely. */
export const SUBMIT_OPTIONS: Record<Subject, Choice<SubmitKey>[]> = {
  funding: [
    {
      key: 'applications',
      label: 'submitsApplicationsLabel',
      description: 'submitsApplicationsDescription',
    },
    {
      key: 'rough',
      label: 'submitsRoughLabel',
      description: 'submitsRoughFundingDescription',
    },
    {
      key: 'none',
      label: 'submitsNoneLabel',
      description: 'submitsNoneFundingDescription',
    },
  ],
  ideas: [
    {
      key: 'rough',
      label: 'pbShapeIdeasLabel',
      description: 'submitsRoughIdeasDescription',
    },
    {
      key: 'proposals',
      label: 'submitsProposalsLabel',
      description: 'submitsProposalsDescription',
    },
    {
      key: 'none',
      label: 'submitsNoneLabel',
      description: 'submitsNoneIdeasDescription',
    },
  ],
  people: [
    {
      key: 'nominations',
      label: 'submitsNominationsLabel',
      description: 'submitsNominationsDescription',
    },
    {
      key: 'applications',
      label: 'submitsCandidatesLabel',
      description: 'submitsCandidatesDescription',
    },
    {
      key: 'none',
      label: 'submitsNoneLabel',
      description: 'submitsNonePeopleDescription',
    },
  ],
  else: [
    {
      key: 'proposals',
      label: 'submitsWrittenLabel',
      description: 'submitsProposalsDescription',
    },
    {
      key: 'rough',
      label: 'submitsRoughLabel',
      description: 'submitsRoughElseDescription',
    },
    {
      key: 'none',
      label: 'submitsNoneLabel',
      description: 'submitsNoneElseDescription',
    },
  ],
};

/** The Q3 heading, worded for the subject. */
export const SUBMIT_HEADING: Record<Subject, WizardCopyKey> = {
  funding: 'submitsFundingHeading',
  ideas: 'submitsPutForwardHeading',
  people: 'submitsPeopleHeading',
  else: 'submitsPutForwardHeading',
};

// --- Q4 ---------------------------------------------------------------------

export const DECISION_OPTIONS: Choice<Decision>[] = [
  {
    key: 'vote',
    label: 'decisionVoteLabel',
    description: 'decisionVoteDescription',
  },
  {
    key: 'review',
    label: 'decisionReviewLabel',
    description: 'decisionReviewDescription',
  },
  {
    key: 'both',
    label: 'decisionBothLabel',
    description: 'decisionBothDescription',
  },
  {
    key: 'agree',
    label: 'decisionAgreeLabel',
    description: 'decisionAgreeDescription',
  },
];

// --- Sequencing -------------------------------------------------------------

/**
 * Several subjects only force a choice when the process has an end, so the
 * focus screen sits after the cadence question rather than before it.
 */
export function otherStepList(answers: OtherAnswers): OtherStep[] {
  const needsFocus =
    answers.subjects.length > 1 && answers.cadence === 'timeline';
  // Declared, not inlined: `['focus']` inside a spread widens to `string[]`.
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

/** The subject driving the wording; several at once falls back to general. */
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

/** How to name what is being decided, inside a sentence. */
export function subjectPhrase(
  answers: OtherAnswers,
  t: TranslateFn<'decisions.createWizard'>,
  locale: string,
): string {
  // 'subjectElseLabel' speaks in the user's own words, untranslated.
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

const INTAKE_NAME: Record<SubmitKey, WizardCopyKey> = {
  applications: 'collectApplications',
  proposals: 'collectProposals',
  rough: 'collectIdeas',
  nominations: 'collectNominations',
  none: 'collectSubmissions',
};

/** The same phases, named for the people who will read them on the timeline. */
const INTAKE_PHASE_NAME: Record<SubmitKey, WizardCopyKey> = {
  applications: 'sendYourApplication',
  proposals: 'sendYourProposal',
  rough: 'shareYourIdeas',
  nominations: 'makeNomination',
  none: 'sendYourSubmission',
};

const INTAKE_DESCRIPTION: Record<SubmitKey, WizardCopyKey> = {
  applications: 'gatherFullApplicationsFromAnyone',
  proposals: 'gatherWrittenProposalsFromAnyone',
  rough: 'keptLightSoAnyoneCan',
  nominations: 'gatherNamesPeoplePutForward',
  none: 'gatherWhatPeoplePutForward',
};

/**
 * Build the phase mapping. Order follows practice: intake, a review that
 * narrows, developing what survived, the decision, publishing it.
 */
export function composeOtherPieces(answers: OtherAnswers): ProcessPiece[] {
  const subject = activeSubject(answers);
  const submits = answers.submits ?? 'none';
  const decision = answers.decision ?? 'vote';
  const discussionOnly = decision === 'agree';

  // Always open — one intake that never closes, and support shown in the open.
  if (answers.cadence === 'ongoing') {
    const votingCapabilities: WizardCopyKey[] =
      decision === 'vote' || decision === 'both' ? ['runVoteItemWhenYou'] : [];

    return [
      {
        name: INTAKE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseName:
          INTAKE_PHASE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseType: 'submissions',
        description: 'staysOpenMembersPostWhenever',
        capabilities: [
          'setYourOwnQuestions',
          'inviteYourGroup',
          'letMembersCommentLikeShow',
          ...votingCapabilities,
          'noClosingDateRunsLong',
        ],
        norm: 'mostGroupsRunningThisWay',
      },
    ];
  }

  const pieces: ProcessPiece[] = [];

  if (submits !== 'none') {
    // Without a formal vote, support has to show somewhere — so the intake
    // itself carries the commenting and liking.
    const supportCapabilities: WizardCopyKey[] = discussionOnly
      ? ['letPeopleCommentLikeShow']
      : [];

    pieces.push({
      name: INTAKE_NAME[submits],
      phaseName: INTAKE_PHASE_NAME[submits],
      phaseType: 'submissions',
      description: INTAKE_DESCRIPTION[submits],
      capabilities: [
        'setYourOwnQuestions',
        'openAllInviteOnly',
        'addDeadline',
        ...supportCapabilities,
      ],
    });
  }

  if (decision === 'review' || decision === 'both') {
    pieces.push({
      name: decision === 'both' ? 'narrowDown' : 'reviewDecide',
      phaseName: decision === 'both' ? 'shortlisting' : 'reviewDecide',
      phaseType: 'review',
      description:
        decision === 'both'
          ? 'smallerGroupNarrowsDescription'
          : 'smallerGroupDecidesDescription',
      capabilities: [
        'buildScoringRubric',
        'inviteReviewersPanel',
        'scoreBlindIfYouWant',
        'chooseWhatAdvances',
      ],
    });
  }

  if (submits === 'rough') {
    pieces.push({
      name: 'workThemUp',
      phaseName: 'buildThemUp',
      phaseType: 'develop',
      description: 'whatAdvancesGetsBuiltInto',
      capabilities: [
        'buildWhatWasAlreadySubmitted',
        'addQuestionsFullerVersion',
        'setDeadline',
      ],
    });
  }

  if (decision === 'vote' || decision === 'both') {
    pieces.push({
      name: subject === 'people' ? 'holdVote' : 'putVote',
      phaseName: 'votePhase',
      phaseType: 'voting',
      description: 'everyoneTakingPartDecidesTogether',
      capabilities: [
        'chooseHowPeopleVote',
        'combineWaysVoting',
        'decideWhoCanVote',
        'keepVotesAnonymous',
      ],
    });
  }

  pieces.push({
    name: 'shareWhatWasDecided',
    phaseName: 'seeWhatWasDecided',
    phaseType: 'results',
    capabilities: [
      discussionOnly ? 'publishWhatGroupLanded' : 'publishOutcome',
      'showTitlesOnlyFullEntries',
      'notifyEveryoneWhoTookPart',
    ],
  });

  return pieces;
}

const INTAKE_RECAP: Record<SubmitKey, WizardCopyKey> = {
  none: 'recapIntakeNone',
  rough: 'recapIntakeRough',
  nominations: 'recapIntakeNominations',
  applications: 'recapIntakeApplications',
  proposals: 'recapIntakeWritten',
};

const DECISION_RECAP: Record<Decision, WizardCopyKey> = {
  vote: 'recapDecisionVote',
  review: 'recapDecisionReview',
  both: 'recapDecisionBoth',
  agree: 'recapDecisionAgree',
};

/** A plain-language recap, shown above the mapping on the walkthrough screen. */
export function describeOther(
  answers: OtherAnswers,
  t: TranslateFn<'decisions.createWizard'>,
  locale: string,
): string {
  const subject = subjectPhrase(answers, t, locale);

  if (answers.cadence === 'ongoing') {
    return t('recapOngoing', { subject });
  }

  return t('recapTimeline', {
    subject,
    intake: t(INTAKE_RECAP[answers.submits ?? 'none']),
    call: t(DECISION_RECAP[answers.decision ?? 'vote']),
  });
}
