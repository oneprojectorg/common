import {
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common/client';

import { SHAPE_QUESTION, type GrantDecision } from './content';
import {
  EMPTY_OTHER,
  OTHER_STEPS,
  needsFocus,
  otherCanContinue,
  reconcileOther,
  type OtherAnswers,
  type OtherStep,
} from './otherFlow';
import type { ProcessType, ShapeKey, WizardFlags } from './types';

export const TOTAL_STEPS = 5;

export interface WizardAnswers {
  type: ProcessType | null;
  shape: ShapeKey | null;
  grantDecision: GrantDecision | null;
  other: OtherAnswers;
  name: string;
}

export const EMPTY_ANSWERS: WizardAnswers = {
  type: null,
  shape: null,
  grantDecision: null,
  other: EMPTY_OTHER,
  name: '',
};

export type ScreenId =
  | 'intro'
  | 'type'
  | 'shape'
  | 'grantDecision'
  | OtherStep
  | 'mapping'
  | 'name';

interface Screen {
  step: number;
  /** Omitted for a screen every type shows. */
  types?: ProcessType[];
  /** Whether a flag lets it show at all; a screen off here is never reached. */
  isEnabled?: (flags: WizardFlags) => boolean;
  /** Whether the answers so far call for it, beyond its type. */
  isAsked?: (answers: WizardAnswers) => boolean;
  isComplete: (answers: WizardAnswers) => boolean;
}

const SCREEN: Record<ScreenId, Screen> = {
  intro: { step: 1, isComplete: () => true },
  type: { step: 2, isComplete: ({ type }) => !!type },
  shape: {
    step: 3,
    types: ['grant', 'pb'],
    isComplete: ({ shape }) => !!shape,
  },
  grantDecision: {
    step: 3,
    types: ['grant'],
    isComplete: ({ grantDecision }) => !!grantDecision,
  },
  subjects: {
    step: 3,
    types: ['other'],
    isComplete: ({ other }) => otherCanContinue('subjects', other),
  },
  cadence: {
    step: 3,
    types: ['other'],
    isEnabled: ({ rollingDecisions }) => rollingDecisions,
    isComplete: ({ other }) => otherCanContinue('cadence', other),
  },
  focus: {
    step: 3,
    types: ['other'],
    isAsked: ({ other }) => needsFocus(other),
    isComplete: ({ other }) => otherCanContinue('focus', other),
  },
  submits: {
    step: 3,
    types: ['other'],
    isComplete: ({ other }) => otherCanContinue('submits', other),
  },
  decision: {
    step: 3,
    types: ['other'],
    isComplete: ({ other }) => otherCanContinue('decision', other),
  },
  mapping: { step: 4, isComplete: () => true },
  name: {
    step: 5,
    isComplete: ({ name }) => {
      const length = name.trim().length;

      return (
        length >= PROCESS_NAME_MIN_LENGTH && length <= PROCESS_NAME_MAX_LENGTH
      );
    },
  },
};

const SCREEN_ORDER: ScreenId[] = [
  'intro',
  'type',
  'shape',
  'grantDecision',
  ...OTHER_STEPS,
  'mapping',
  'name',
];

export const isOtherScreen = (screen: ScreenId): screen is OtherStep =>
  OTHER_STEPS.some((step) => step === screen);

export const stepOf = (screen: ScreenId): number => SCREEN[screen].step;

export const isScreenComplete = (
  screen: ScreenId,
  answers: WizardAnswers,
): boolean => SCREEN[screen].isComplete(answers);

/** Whether the type and the flags could ever show the screen. */
function isOffered(
  screen: ScreenId,
  type: ProcessType | null,
  flags: WizardFlags,
): boolean {
  const { types, isEnabled } = SCREEN[screen];

  return (
    (!types || (type !== null && types.includes(type))) &&
    (isEnabled?.(flags) ?? true)
  );
}

function isAsked(
  screen: ScreenId,
  answers: WizardAnswers,
  flags: WizardFlags,
): boolean {
  return (
    isOffered(screen, answers.type, flags) &&
    (SCREEN[screen].isAsked?.(answers) ?? true)
  );
}

/** The screens these answers lead through, in order. */
export function screensFor(
  answers: WizardAnswers,
  flags: WizardFlags,
): ScreenId[] {
  return SCREEN_ORDER.filter((screen) => isAsked(screen, answers, flags));
}

export function nextScreen(
  screen: ScreenId,
  answers: WizardAnswers,
  flags: WizardFlags,
): ScreenId | null {
  return (
    SCREEN_ORDER.slice(SCREEN_ORDER.indexOf(screen) + 1).find((candidate) =>
      isAsked(candidate, answers, flags),
    ) ?? null
  );
}

export function previousScreen(
  screen: ScreenId,
  answers: WizardAnswers,
  flags: WizardFlags,
): ScreenId | null {
  return (
    SCREEN_ORDER.slice(0, SCREEN_ORDER.indexOf(screen))
      .reverse()
      .find((candidate) => isAsked(candidate, answers, flags)) ?? null
  );
}

/** Step 3 divides by every screen the type could ask, so an answer that adds one can't move the bar backwards. */
export function progressPercent(
  screen: ScreenId,
  type: ProcessType | null,
  flags: WizardFlags,
): number {
  const step = stepOf(screen);

  if (step !== 3) {
    return (step / TOTAL_STEPS) * 100;
  }

  const slots = SCREEN_ORDER.filter(
    (candidate) => stepOf(candidate) === 3 && isOffered(candidate, type, flags),
  );
  const slot = slots.indexOf(screen);

  if (slot < 0) {
    return (2 / TOTAL_STEPS) * 100;
  }

  return ((2 + (slot + 1) / slots.length) / TOTAL_STEPS) * 100;
}

/** Run on every change; `previous` is the reconciled state the change was made to. */
export function reconcileAnswers(
  next: WizardAnswers,
  flags: WizardFlags,
  previous?: WizardAnswers,
): WizardAnswers {
  const { type } = next;

  return {
    ...next,
    shape: fittingShape(type, next.shape),
    grantDecision: type === 'grant' ? next.grantDecision : null,
    other:
      type === 'other'
        ? reconcileOther(
            next.other,
            flags,
            previous?.type === 'other' ? previous.other : undefined,
          )
        : EMPTY_OTHER,
  };
}

function fittingShape(
  type: ProcessType | null,
  shape: ShapeKey | null,
): ShapeKey | null {
  if (type === 'other') {
    return 'custom';
  }

  const fits =
    type !== null &&
    !!SHAPE_QUESTION[type]?.options.some((option) => option.key === shape);

  return fits ? shape : null;
}
