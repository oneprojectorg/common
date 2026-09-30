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

/** The wizard's sequencing, kept out of the shell so it can be tested alone. */

export const TOTAL_STEPS = 5;

/** Every screen step 3 can show, across all three pathways. */
export type StepThreeScreen = OtherStep | 'shape' | 'grantDecision';

export const isOtherScreen = (screen: StepThreeScreen): screen is OtherStep =>
  screen !== 'shape' && screen !== 'grantDecision';

/** Step 3 is a sequence of its own: grantmaking asks who decides, and
 * "other" asks four questions that compose their own mapping. */
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

/** Whether the current screen has enough of an answer to move on. */
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

/**
 * Every screen step 3 could show for a type, whatever the answers. Progress
 * divides by these rather than by the screens currently shown, so an answer
 * that adds a screen cannot move the bar backwards; a skipped screen jumps it
 * forward instead.
 */
function stepThreeSlots(type: ProcessType | null): StepThreeScreen[] {
  if (type === 'other') {
    return ['subjects', 'cadence', 'focus', 'submits', 'decision'];
  }

  return type === 'grant' ? ['shape', 'grantDecision'] : ['shape'];
}

/** Runs smoothly through step 3's sub-steps instead of sticking. */
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
