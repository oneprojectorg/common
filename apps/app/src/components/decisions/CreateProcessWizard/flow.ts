import {
  MAX_PROCESS_NAME_LENGTH,
  MIN_PROCESS_NAME_LENGTH,
  type GrantDecision,
} from './content';
import {
  otherCanContinue,
  otherStepList,
  type OtherAnswers,
  type OtherStep,
} from './otherFlow';
import type { ProcessType, ShapeKey } from './types';

export const TOTAL_STEPS = 5;

export type StepThreeScreen = OtherStep | 'shape' | 'grantDecision';

export const isOtherScreen = (screen: StepThreeScreen): screen is OtherStep =>
  screen !== 'shape' && screen !== 'grantDecision';

export function stepThreeScreens(
  type: ProcessType | null,
  other: OtherAnswers,
): StepThreeScreen[] {
  if (type === 'other') {
    return otherStepList(other);
  }

  return type === 'grant' ? ['shape', 'grantDecision'] : ['shape'];
}

export interface WizardAnswers {
  step: number;
  screen: StepThreeScreen;
  type: ProcessType | null;
  shape: ShapeKey | null;
  grantDecision: GrantDecision | null;
  other: OtherAnswers;
  name: string;
}

export function canAdvance({
  step,
  screen,
  type,
  shape,
  grantDecision,
  other,
  name,
}: WizardAnswers): boolean {
  if (step === 2) {
    return !!type;
  }

  if (step === 3) {
    if (isOtherScreen(screen)) {
      return otherCanContinue(screen, other);
    }

    return screen === 'grantDecision' ? !!grantDecision : !!shape;
  }

  if (step === TOTAL_STEPS) {
    const length = name.trim().length;

    return (
      length >= MIN_PROCESS_NAME_LENGTH && length <= MAX_PROCESS_NAME_LENGTH
    );
  }

  return true;
}

/** Every screen step 3 could show, not only those shown: a changing divisor would move the bar backwards. */
function stepThreeSlots(type: ProcessType | null): StepThreeScreen[] {
  if (type === 'other') {
    return ['subjects', 'cadence', 'focus', 'submits', 'decision'];
  }

  return type === 'grant' ? ['shape', 'grantDecision'] : ['shape'];
}

export function progressPercent(
  step: number,
  screen: StepThreeScreen,
  type: ProcessType | null,
): number {
  if (step === 3) {
    const slots = stepThreeSlots(type);
    const slot = Math.max(slots.indexOf(screen), 0);

    return ((2 + (slot + 1) / slots.length) / TOTAL_STEPS) * 100;
  }

  return (step / TOTAL_STEPS) * 100;
}
