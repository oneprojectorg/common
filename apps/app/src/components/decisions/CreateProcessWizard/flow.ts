import { MIN_PROCESS_NAME_LENGTH, type GrantDecision } from './content';
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
    return name.trim().length >= MIN_PROCESS_NAME_LENGTH;
  }

  return true;
}

/** Runs smoothly through step 3's sub-steps instead of sticking. */
export function progressPercent(
  step: number,
  subIndex: number,
  screenCount: number,
): number {
  if (step === 3) {
    return ((2 + (subIndex + 1) / screenCount) / TOTAL_STEPS) * 100;
  }

  return (step / TOTAL_STEPS) * 100;
}
