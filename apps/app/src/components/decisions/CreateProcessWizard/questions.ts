// What the wizard asks: the options behind every choice screen, and what each subject changes. Read by flow.ts and phases.ts.
import type { ProcessType } from '@op/common/client';

import {
  SUBJECTS,
  type Cadence,
  type Choice,
  type Decision,
  type GrantDecision,
  type ShapeKey,
  type Subject,
  type SubmitKey,
  type WizardCopyKey,
} from './types';

export const TYPE_OPTIONS: Choice<ProcessType>[] = [
  {
    key: 'grant',
    label: 'grantTypeLabel',
    description: 'grantTypeDescription',
  },
  { key: 'pb', label: 'pbTypeLabel', description: 'pbTypeDescription' },
  {
    key: 'other',
    label: 'otherTypeLabel',
    description: 'otherTypeDescription',
  },
];

interface ShapeQuestion {
  heading: WizardCopyKey;
  options: Choice<ShapeKey>[];
}

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

export const GRANT_DECISION_OPTIONS: Choice<GrantDecision>[] = [
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
];

interface SubjectMeta {
  label: WizardCopyKey;
  description: WizardCopyKey;
  /** The subject as a noun, for the recap. */
  noun: WizardCopyKey;
  submitsHeading: WizardCopyKey;
  submitOptions: Choice<SubmitKey>[];
  /** How the vote phase is pitched. */
  voteName: WizardCopyKey;
}

export const SUBJECT_META: Record<Subject, SubjectMeta> = {
  funding: {
    label: 'subjectFundingLabel',
    description: 'subjectFundingDescription',
    noun: 'subjectFundingNoun',
    submitsHeading: 'submitsFundingHeading',
    submitOptions: [
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
    voteName: 'putVote',
  },
  ideas: {
    label: 'subjectIdeasLabel',
    description: 'subjectIdeasDescription',
    noun: 'subjectIdeasNoun',
    submitsHeading: 'submitsPutForwardHeading',
    submitOptions: [
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
    voteName: 'putVote',
  },
  people: {
    label: 'subjectPeopleLabel',
    description: 'subjectPeopleDescription',
    noun: 'subjectPeopleNoun',
    submitsHeading: 'submitsPeopleHeading',
    submitOptions: [
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
    voteName: 'holdVote',
  },
  else: {
    label: 'subjectElseLabel',
    description: 'subjectElseDescription',
    noun: 'subjectElseNoun',
    submitsHeading: 'submitsPutForwardHeading',
    submitOptions: [
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
    voteName: 'putVote',
  },
};

export const SUBJECT_OPTIONS: Choice<Subject>[] = SUBJECTS.map((subject) => ({
  key: subject,
  label: SUBJECT_META[subject].label,
  description: SUBJECT_META[subject].description,
}));

/** Nothing picked reads as something else. */
export const subjectMeta = (subject: Subject | null): SubjectMeta =>
  SUBJECT_META[subject ?? 'else'];

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
