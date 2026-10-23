// What the wizard asks: the heading and options behind every choice screen. Read by flow.ts.
import type {
  Cadence,
  Choice,
  Decision,
  GrantDecision,
  ProcessType,
  ShapeKey,
  Subject,
  SubmitKey,
  WizardCopyKey,
} from './types';

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
