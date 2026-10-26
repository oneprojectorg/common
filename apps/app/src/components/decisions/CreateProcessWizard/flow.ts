import { createInstanceSchema } from '@op/common/client';
import type { ProcessType } from '@op/common/client';

import {
  CADENCE_OPTIONS,
  DECISION_OPTIONS,
  GRANT_DECISION_OPTIONS,
  SHAPE_QUESTION,
  SUBJECT_OPTIONS,
  TYPE_OPTIONS,
  subjectMeta,
} from './questions';
import type { Choice, WizardAnswers, WizardCopyKey } from './types';

export type { WizardAnswers } from './types';

export const EMPTY_ANSWERS: WizardAnswers = {
  type: null,
  shape: null,
  grantDecision: null,
  subject: null,
  subjectText: '',
  cadence: null,
  submits: null,
  decision: null,
  name: '',
};

type AnswerKey = keyof WizardAnswers;

/** An answer picked from options, so one that can be unanswered. */
type ChoiceKey = {
  [K in AnswerKey]: null extends WizardAnswers[K] ? K : never;
}[AnswerKey];

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
}

/** Answered by picking one option; an option no longer offered clears. */
interface ChoiceQuestion<K extends ChoiceKey> extends Question<K> {
  heading: (answers: WizardAnswers) => WizardCopyKey;
  description?: (answers: WizardAnswers) => WizardCopyKey | undefined;
  /** Module constants: a different array is a different question. */
  options: (answers: WizardAnswers) => Choice<NonNullable<WizardAnswers[K]>>[];
}

export type ChoiceScreen = { [K in ChoiceKey]: ChoiceQuestion<K> }[ChoiceKey];

type Screen = Walkthrough | Question<'name'> | ChoiceScreen;

export type ScreenId = Screen['id'];

/** The option matching `key`, so an answer is always one that was offered. */
const offered = <K extends string>(
  options: Choice<K>[],
  key: string | null,
): K | null => options.find((option) => option.key === key)?.key ?? null;

/** Asked only for the types with shapes; `types` below says which. */
const shapeQuestion = (type: ProcessType | null) =>
  SHAPE_QUESTION[type === 'pb' ? 'pb' : 'grant'];

/** In order. A screen is asked when its type and `isAsked` allow; an unasked answer clears. */
const SCREENS: Screen[] = [
  { id: 'intro', step: 1 },
  {
    id: 'type',
    step: 2,
    heading: () => 'typeHeading',
    description: () => 'typeDescription',
    options: () => TYPE_OPTIONS,
  },
  {
    id: 'shape',
    step: 3,
    types: ['grant', 'pb'],
    heading: ({ type }) => shapeQuestion(type).heading,
    options: ({ type }) => shapeQuestion(type).options,
  },
  {
    id: 'grantDecision',
    step: 3,
    types: ['grant'],
    heading: () => 'grantDecisionHeading',
    options: () => GRANT_DECISION_OPTIONS,
  },
  {
    id: 'subject',
    step: 3,
    types: ['other'],
    heading: () => 'subjectHeading',
    description: () => 'subjectDescription',
    options: () => SUBJECT_OPTIONS,
    isComplete: ({ subject, subjectText }) =>
      subject !== null && (subject !== 'else' || subjectText.trim().length > 0),
  },
  {
    id: 'cadence',
    step: 3,
    types: ['other'],
    heading: () => 'cadenceHeading',
    options: () => CADENCE_OPTIONS,
  },
  {
    id: 'submits',
    step: 3,
    types: ['other'],
    heading: ({ subject }) => subjectMeta(subject).submitsHeading,
    description: ({ cadence }) =>
      cadence === 'ongoing' ? 'submitsOngoingDescription' : undefined,
    options: ({ subject }) => subjectMeta(subject).submitOptions,
  },
  {
    id: 'decision',
    step: 3,
    types: ['other'],
    isAsked: ({ cadence }) => cadence !== 'ongoing',
    heading: () => 'decisionHeading',
    options: () => DECISION_OPTIONS,
  },
  { id: 'mapping', step: 4 },
  {
    id: 'name',
    step: 5,
    isComplete: ({ name }) =>
      createInstanceSchema.shape.name.safeParse(name).success,
  },
];

export const TOTAL_STEPS = Math.max(...SCREENS.map((screen) => screen.step));

export const SCREEN_IDS: ScreenId[] = SCREENS.map((screen) => screen.id);

const isQuestion = (screen: Screen): screen is Exclude<Screen, Walkthrough> =>
  screen.id in EMPTY_ANSWERS;

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

/** The option picked so far. */
export const chosenOption = (
  screen: ChoiceScreen,
  answers: WizardAnswers,
): string | null => answers[screen.id];

/** What picking an option answers; settle it before use. */
export const chooseOption = (
  screen: ChoiceScreen,
  key: string,
  answers: WizardAnswers,
): WizardAnswers => ({ ...answers, [screen.id]: key });

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

  return ((2 + (slot + 1) / slots.length) / TOTAL_STEPS) * 100;
}

/**
 * Settles the answers screen by screen, so each rule sees the earlier answers
 * already settled. `previous` is the settled state the change was made to.
 */
export function settleAnswers(
  next: WizardAnswers,
  previous?: WizardAnswers,
): WizardAnswers {
  return SCREENS.reduce(
    (answers, screen) =>
      isQuestion(screen)
        ? { ...answers, [screen.id]: settledAnswer(screen, answers, previous) }
        : answers,
    next,
  );
}

function settledAnswer(
  screen: Exclude<Screen, Walkthrough>,
  answers: WizardAnswers,
  previous: WizardAnswers | undefined,
): WizardAnswers[AnswerKey] {
  if (!isAsked(screen, answers)) {
    return EMPTY_ANSWERS[screen.id];
  }

  if (!isChoiceScreen(screen)) {
    return answers[screen.id];
  }

  const options = screen.options(answers);

  if (previous && screen.options(previous) !== options) {
    return null;
  }

  return offered(options, answers[screen.id]);
}

export interface WizardState {
  screen: ScreenId;
  answers: WizardAnswers;
}

export const INITIAL_STATE: WizardState = {
  screen: 'intro',
  answers: EMPTY_ANSWERS,
};

type WizardEvent =
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
