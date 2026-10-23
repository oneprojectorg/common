import {
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common/client';

import {
  GRANT_DECISION_QUESTION,
  SHAPE_QUESTION,
  TYPE_OPTIONS,
} from './content';
import {
  CADENCE_OPTIONS,
  DECISION_OPTIONS,
  SUBJECT_OPTIONS,
  SUBMIT_HEADING,
  SUBMIT_OPTIONS,
} from './otherContent';
import type {
  Choice,
  ProcessType,
  ShapeKey,
  Subject,
  SubjectAnswer,
  WizardAnswers,
  WizardCopyKey,
} from './types';

export type { WizardAnswers } from './types';

export const TOTAL_STEPS = 5;

export const EMPTY_ANSWERS: WizardAnswers = {
  type: null,
  shape: null,
  grantDecision: null,
  subject: null,
  cadence: null,
  submits: null,
  decision: null,
  name: '',
};

type AnswerKey = keyof WizardAnswers;

interface ScreenRules {
  step: number;
  /** Omitted for a screen every type shows. */
  types?: ProcessType[];
  /** Whether the answers so far call for it, beyond its type. */
  isAsked?: (answers: WizardAnswers) => boolean;
}

/** A screen with nothing to answer. */
interface Walkthrough extends ScreenRules {
  id: 'intro' | 'mapping';
}

interface Question<K extends AnswerKey> extends ScreenRules {
  id: K;
  /** Defaults to an answer being present. */
  isComplete?: (answers: WizardAnswers) => boolean;
  /**
   * The answer that still fits the settled earlier answers. `previous` is the
   * state the change was made to, for a rule that must clear on any change.
   */
  reconcile?: (
    answers: WizardAnswers,
    previous?: WizardAnswers,
  ) => WizardAnswers[K];
}

/** A question answered by picking one option. */
interface ChoiceQuestion<K extends AnswerKey> extends Question<K> {
  heading: (answers: WizardAnswers) => WizardCopyKey;
  description?: (answers: WizardAnswers) => WizardCopyKey | undefined;
  options: (answers: WizardAnswers) => Choice<string>[];
  /** The option picked so far. */
  chosen: (answers: WizardAnswers) => string | null;
  /** What picking an option answers. */
  choose: (key: string, answers: WizardAnswers) => Partial<WizardAnswers>;
}

type Screen =
  | Walkthrough
  | Question<'name'>
  | ChoiceQuestion<'type'>
  | ChoiceQuestion<'shape'>
  | ChoiceQuestion<'grantDecision'>
  | ChoiceQuestion<'subject'>
  | ChoiceQuestion<'cadence'>
  | ChoiceQuestion<'submits'>
  | ChoiceQuestion<'decision'>;

export type ScreenId = Screen['id'];

export type ChoiceScreen = Extract<Screen, { options: unknown }>;

/** The option matching `key`, so an answer is always one that was offered. */
const offered = <K extends string>(
  options: Choice<K>[] | undefined,
  key: string | null,
): K | null => options?.find((option) => option.key === key)?.key ?? null;

/** Asked only for the types with shapes; `types` below says which. */
const shapeQuestion = (type: ProcessType | null) =>
  SHAPE_QUESTION[type === 'pb' ? 'pb' : 'grant'];

const submitOptions = ({ subject }: WizardAnswers) =>
  SUBMIT_OPTIONS[subject?.kind ?? 'else'];

/** Something else keeps the words already typed. */
function subjectAnswer(
  kind: Subject | null,
  previous: SubjectAnswer | null,
): SubjectAnswer | null {
  if (kind === null) {
    return null;
  }

  if (kind === 'else') {
    return { kind, text: previous?.kind === 'else' ? previous.text : '' };
  }

  return { kind };
}

/** In order. A screen is asked when its type and `isAsked` allow; an unasked answer clears. */
const SCREENS: Screen[] = [
  { id: 'intro', step: 1 },
  {
    id: 'type',
    step: 2,
    heading: () => 'typeHeading',
    description: () => 'typeDescription',
    options: () => TYPE_OPTIONS,
    chosen: ({ type }) => type,
    choose: (key) => ({ type: offered(TYPE_OPTIONS, key) }),
  },
  {
    id: 'shape',
    step: 3,
    types: ['grant', 'pb'],
    heading: ({ type }) => shapeQuestion(type).heading,
    options: ({ type }) => shapeQuestion(type).options,
    chosen: ({ shape }) => shape,
    choose: (key, { type }) => ({
      shape: offered(shapeQuestion(type).options, key),
    }),
    reconcile: ({ type, shape }) => offered(shapeQuestion(type).options, shape),
  },
  {
    id: 'grantDecision',
    step: 3,
    types: ['grant'],
    heading: () => GRANT_DECISION_QUESTION.heading,
    options: () => GRANT_DECISION_QUESTION.options,
    chosen: ({ grantDecision }) => grantDecision,
    choose: (key) => ({
      grantDecision: offered(GRANT_DECISION_QUESTION.options, key),
    }),
  },
  {
    id: 'subject',
    step: 3,
    types: ['other'],
    heading: () => 'subjectHeading',
    description: () => 'subjectDescription',
    options: () => SUBJECT_OPTIONS,
    chosen: ({ subject }) => subject?.kind ?? null,
    choose: (key, { subject }) => ({
      subject: subjectAnswer(offered(SUBJECT_OPTIONS, key), subject),
    }),
    isComplete: ({ subject }) =>
      subject !== null &&
      (subject.kind !== 'else' || subject.text.trim().length > 0),
  },
  {
    id: 'cadence',
    step: 3,
    types: ['other'],
    heading: () => 'cadenceHeading',
    options: () => CADENCE_OPTIONS,
    chosen: ({ cadence }) => cadence,
    choose: (key) => ({ cadence: offered(CADENCE_OPTIONS, key) }),
  },
  {
    id: 'submits',
    step: 3,
    types: ['other'],
    heading: ({ subject }) => SUBMIT_HEADING[subject?.kind ?? 'else'],
    description: ({ cadence }) =>
      cadence === 'ongoing' ? 'submitsOngoingDescription' : undefined,
    options: submitOptions,
    chosen: ({ submits }) => submits,
    choose: (key, answers) => ({
      submits: offered(submitOptions(answers), key),
    }),
    // A key is labelled per subject, so a new subject clears it even when offering the same key.
    reconcile: (answers, previous) =>
      answers.subject === null ||
      (previous !== undefined &&
        previous.subject?.kind !== answers.subject.kind)
        ? null
        : offered(submitOptions(answers), answers.submits),
  },
  {
    id: 'decision',
    step: 3,
    types: ['other'],
    isAsked: ({ cadence }) => cadence !== 'ongoing',
    heading: () => 'decisionHeading',
    options: () => DECISION_OPTIONS,
    chosen: ({ decision }) => decision,
    choose: (key) => ({ decision: offered(DECISION_OPTIONS, key) }),
  },
  { id: 'mapping', step: 4 },
  {
    id: 'name',
    step: 5,
    isComplete: ({ name }) => {
      const length = name.trim().length;

      return (
        length >= PROCESS_NAME_MIN_LENGTH && length <= PROCESS_NAME_MAX_LENGTH
      );
    },
  },
];

const isQuestion = (screen: Screen): screen is Exclude<Screen, Walkthrough> =>
  screen.id !== 'intro' && screen.id !== 'mapping';

export const isChoiceScreen = (screen: Screen): screen is ChoiceScreen =>
  'options' in screen;

export function screenOf(id: ScreenId): Screen {
  const screen = SCREENS.find((candidate) => candidate.id === id);

  if (!screen) {
    throw new Error(`Unknown wizard screen: ${id}`);
  }

  return screen;
}

function isForType(screen: ScreenRules, type: ProcessType | null): boolean {
  return !screen.types || (type !== null && screen.types.includes(type));
}

function isAsked(screen: ScreenRules, answers: WizardAnswers): boolean {
  return isForType(screen, answers.type) && (screen.isAsked?.(answers) ?? true);
}

export const stepOf = (id: ScreenId): number => screenOf(id).step;

export function isScreenComplete(
  id: ScreenId,
  answers: WizardAnswers,
): boolean {
  const screen = screenOf(id);

  if (!isQuestion(screen)) {
    return true;
  }

  return screen.isComplete?.(answers) ?? answers[screen.id] !== null;
}

/** The screens these answers lead through, in order. */
export function screensFor(answers: WizardAnswers): ScreenId[] {
  return SCREENS.filter((screen) => isAsked(screen, answers)).map(
    (screen) => screen.id,
  );
}

const indexOf = (id: ScreenId): number =>
  SCREENS.findIndex((screen) => screen.id === id);

export function nextScreen(
  id: ScreenId,
  answers: WizardAnswers,
): ScreenId | null {
  return (
    SCREENS.slice(indexOf(id) + 1).find((screen) => isAsked(screen, answers))
      ?.id ?? null
  );
}

export function previousScreen(
  id: ScreenId,
  answers: WizardAnswers,
): ScreenId | null {
  return (
    SCREENS.slice(0, indexOf(id))
      .reverse()
      .find((screen) => isAsked(screen, answers))?.id ?? null
  );
}

/** Step 3 divides by every screen the type could ask, so an answer that adds one can't move the bar backwards. */
export function progressPercent(
  id: ScreenId,
  type: ProcessType | null,
): number {
  const step = stepOf(id);

  if (step !== 3) {
    return (step / TOTAL_STEPS) * 100;
  }

  const slots = SCREENS.filter(
    (screen) => screen.step === 3 && isForType(screen, type),
  );
  const slot = slots.findIndex((screen) => screen.id === id);

  if (slot < 0) {
    return (2 / TOTAL_STEPS) * 100;
  }

  return ((2 + (slot + 1) / slots.length) / TOTAL_STEPS) * 100;
}

/** The other pathway composes its shape from its questions instead of asking. */
export const shapeOf = ({ type, shape }: WizardAnswers): ShapeKey | null =>
  type === 'other' ? 'custom' : shape;

/**
 * Settles the answers screen by screen, so each rule sees the earlier answers
 * already settled. `previous` is the settled state the change was made to.
 */
export function settleAnswers(
  next: WizardAnswers,
  previous?: WizardAnswers,
): WizardAnswers {
  return SCREENS.reduce(
    (settled, screen) =>
      isQuestion(screen) ? settle(settled, screen, previous) : settled,
    next,
  );
}

function settle<K extends AnswerKey>(
  answers: WizardAnswers,
  question: Question<K>,
  previous: WizardAnswers | undefined,
): WizardAnswers {
  const value = !isAsked(question, answers)
    ? EMPTY_ANSWERS[question.id]
    : question.reconcile
      ? question.reconcile(answers, previous)
      : answers[question.id];

  return { ...answers, [question.id]: value };
}

export interface WizardState {
  screen: ScreenId;
  answers: WizardAnswers;
}

export const INITIAL_STATE: WizardState = {
  screen: 'intro',
  answers: EMPTY_ANSWERS,
};

export type WizardEvent =
  | { type: 'answer'; patch: Partial<WizardAnswers> }
  | { type: 'next' }
  | { type: 'back' };

export function wizardReducer(
  state: WizardState,
  event: WizardEvent,
): WizardState {
  switch (event.type) {
    case 'answer':
      return {
        ...state,
        answers: settleAnswers(
          { ...state.answers, ...event.patch },
          state.answers,
        ),
      };
    case 'next': {
      if (!isScreenComplete(state.screen, state.answers)) {
        return state;
      }

      const screen = nextScreen(state.screen, state.answers);

      return screen ? { ...state, screen } : state;
    }
    case 'back': {
      const screen = previousScreen(state.screen, state.answers);

      return screen ? { ...state, screen } : state;
    }
  }
}

/**
 * Pulls saved progress back to the first unanswered question, so answers from
 * an older wizard can't land the creator past one.
 */
export function resumeWizard(saved: WizardState): WizardState {
  const answers = settleAnswers(saved.answers);
  const screens = screensFor(answers);
  const target = screens.includes(saved.screen)
    ? saved.screen
    : (previousScreen(saved.screen, answers) ?? 'intro');
  const screen =
    screens.find(
      (candidate) =>
        candidate === target || !isScreenComplete(candidate, answers),
    ) ?? target;

  return { screen, answers };
}
