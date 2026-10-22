import { type ReactNode, createElement } from 'react';

import type { TranslateFn } from '@/lib/i18n';

import type { Choice, ProcessPiece, WizardCopyKey } from './types';

export type Subject = 'funding' | 'ideas' | 'people' | 'else';

export type Cadence = 'timeline' | 'ongoing';

export type SubmitKey =
  | 'applications'
  | 'proposals'
  | 'rough'
  | 'nominations'
  | 'none';

export type Decision = 'vote' | 'review' | 'both' | 'agree';

export interface OtherAnswers {
  subjects: Subject[];
  elseText: string;
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

export const OTHER_STEPS = [
  'subjects',
  'cadence',
  'focus',
  'submits',
  'decision',
] as const;

export type OtherStep = (typeof OTHER_STEPS)[number];

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

const SUBJECT_NOUN: Record<Subject, WizardCopyKey> = {
  funding: 'subjectFundingNoun',
  ideas: 'subjectIdeasNoun',
  people: 'subjectPeopleNoun',
  else: 'subjectElseNoun',
};

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
      label: 'submitsIdeasLabel',
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

export const SUBMIT_HEADING: Record<Subject, WizardCopyKey> = {
  funding: 'submitsFundingHeading',
  ideas: 'submitsPutForwardHeading',
  people: 'submitsPeopleHeading',
  else: 'submitsPutForwardHeading',
};

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

export const needsFocus = ({ subjects, cadence }: OtherAnswers): boolean =>
  subjects.length > 1 && cadence === 'timeline';

/**
 * `submits` also clears when the active subject changes: a key is labelled per
 * subject. An always-open process asks no decision question, so it clears too.
 */
export function reconcileOther(
  next: OtherAnswers,
  previous?: OtherAnswers,
): OtherAnswers {
  const settled: OtherAnswers = {
    ...next,
    decision: next.cadence === 'ongoing' ? null : next.decision,
    elseText: next.subjects.includes('else') ? next.elseText : '',
    focus:
      next.focus && needsFocus(next) && next.subjects.includes(next.focus)
        ? next.focus
        : null,
  };
  const subject = activeSubject(settled);
  const isOffered = SUBMIT_OPTIONS[subject].some(
    (option) => option.key === settled.submits,
  );
  const subjectChanged =
    previous !== undefined && activeSubject(previous) !== subject;

  return {
    ...settled,
    submits: isOffered && !subjectChanged ? settled.submits : null,
  };
}

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

/** Several subjects at once read as `else`. */
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

export function subjectPhrase(
  answers: OtherAnswers,
  t: TranslateFn<'decisions.createWizard'>,
  locale: string,
): string {
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

const INTAKE_NAME: Record<SubmitKey, WizardCopyKey> = {
  applications: 'collectApplications',
  proposals: 'collectProposals',
  rough: 'collectIdeas',
  nominations: 'collectNominations',
  none: 'collectSubmissions',
};

const INTAKE_PHASE_NAME: Record<SubmitKey, WizardCopyKey> = {
  applications: 'sendYourApplication',
  proposals: 'sendYourProposal',
  rough: 'shareYourIdeas',
  nominations: 'makeNomination',
  none: 'sendYourSubmission',
};

const INTAKE_DESCRIPTION: Record<SubmitKey, WizardCopyKey> = {
  applications: 'collectApplicationsDescription',
  proposals: 'collectWrittenProposalsDescription',
  rough: 'collectIdeasDescription',
  nominations: 'collectNominationsDescription',
  none: 'collectSubmissionsDescription',
};

const REVIEW_CAPABILITIES: WizardCopyKey[] = [
  'buildScoringRubric',
  'inviteReviewersPanel',
  'scoreBlindIfYouWant',
  'chooseWhatAdvances',
];

export function composeOtherPieces(answers: OtherAnswers): ProcessPiece[] {
  const subject = activeSubject(answers);
  const submits = answers.submits ?? 'none';

  if (answers.cadence === 'ongoing') {
    return [
      {
        name: INTAKE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseName:
          INTAKE_PHASE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseType: 'submissions',
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
  const pieces: ProcessPiece[] = [];

  if (submits !== 'none') {
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

  if (decision === 'both' || (decision === 'review' && submits === 'rough')) {
    pieces.push({
      name: 'narrowDown',
      phaseName: 'shortlisting',
      phaseType: 'review',
      description:
        decision === 'both'
          ? 'narrowDownDescription'
          : 'narrowDownToWorkUpDescription',
      capabilities: REVIEW_CAPABILITIES,
    });
  }

  if (submits === 'rough') {
    pieces.push({
      name: 'workThemUp',
      phaseName: 'buildThemUp',
      phaseType: 'submissions',
      description: 'workThemUpDescription',
      capabilities: [
        'buildWhatWasAlreadySubmitted',
        'addQuestionsFullerVersion',
        'setDeadline',
      ],
    });
  }

  if (decision === 'review') {
    pieces.push({
      name: 'reviewDecide',
      phaseName: 'reviewDecide',
      phaseType: 'review',
      description: 'reviewDecideDescription',
      capabilities: REVIEW_CAPABILITIES,
    });
  }

  if (decision === 'vote' || decision === 'both') {
    pieces.push({
      name: subject === 'people' ? 'holdVote' : 'putVote',
      phaseName: 'votePhase',
      phaseType: 'voting',
      description: 'groupVoteDescription',
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

export function describeOther(
  answers: OtherAnswers,
  t: TranslateFn<'decisions.createWizard'>,
  locale: string,
): ReactNode {
  const subject = subjectPhrase(answers, t, locale);
  const bdi = (chunks: ReactNode) => createElement('bdi', null, chunks);

  if (answers.cadence === 'ongoing') {
    return t.rich('recapOngoing', { subject, bdi });
  }

  return t.rich('recapTimeline', {
    subject,
    bdi,
    intake: t(INTAKE_RECAP[answers.submits ?? 'none']),
    call: t(DECISION_RECAP[answers.decision ?? 'vote']),
  });
}
