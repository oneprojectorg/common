import {
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common/client';

import { SHAPE_QUESTION } from './content';
import { SUBMIT_OPTIONS } from './otherContent';
import type { Choice, ProcessType, ShapeKey, WizardAnswers } from './types';

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

type Screen = Walkthrough | { [K in AnswerKey]: Question<K> }[AnswerKey];

export type ScreenId = Screen['id'];

const offered = <K extends string>(
  options: Choice<K>[] | undefined,
  answer: K | null,
): K | null =>
  options?.some((option) => option.key === answer) ? answer : null;

/** In order. A screen is asked when its type and `isAsked` allow; an unasked answer clears. */
const SCREENS: Screen[] = [
  { id: 'intro', step: 1 },
  { id: 'type', step: 2 },
  {
    id: 'shape',
    step: 3,
    types: ['grant', 'pb'],
    reconcile: ({ type, shape }) =>
      offered(type ? SHAPE_QUESTION[type]?.options : undefined, shape),
  },
  { id: 'grantDecision', step: 3, types: ['grant'] },
  {
    id: 'subject',
    step: 3,
    types: ['other'],
    isComplete: ({ subject }) =>
      subject !== null &&
      (subject.kind !== 'else' || subject.text.trim().length > 0),
  },
  { id: 'cadence', step: 3, types: ['other'] },
  {
    id: 'submits',
    step: 3,
    types: ['other'],
    // A key is labelled per subject, so a new subject clears it even when offering the same key.
    reconcile: ({ subject, submits }, previous) =>
      subject === null ||
      (previous !== undefined && previous.subject?.kind !== subject.kind)
        ? null
        : offered(SUBMIT_OPTIONS[subject.kind], submits),
  },
  {
    id: 'decision',
    step: 3,
    types: ['other'],
    isAsked: ({ cadence }) => cadence !== 'ongoing',
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

function screenOf(id: ScreenId): Screen {
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
