import { describe, expect, it } from 'vitest';

import {
  TOTAL_STEPS,
  canAdvance,
  progressPercent,
  stepThreeScreens,
  type WizardAnswers,
} from './flow';
import { EMPTY_OTHER } from './otherFlow';

const answers = (patch: Partial<WizardAnswers>): WizardAnswers => ({
  step: 1,
  screen: 'shape',
  type: null,
  shape: null,
  grantDecision: null,
  other: EMPTY_OTHER,
  name: '',
  ...patch,
});

describe('stepThreeScreens', () => {
  it('asks grantmaking who decides, after the shape', () => {
    expect(stepThreeScreens('grant', EMPTY_OTHER)).toEqual([
      'shape',
      'grantDecision',
    ]);
  });

  it('asks budgeting for the shape alone', () => {
    expect(stepThreeScreens('pb', EMPTY_OTHER)).toEqual(['shape']);
  });

  it('hands the other pathway its own question list', () => {
    expect(stepThreeScreens('other', EMPTY_OTHER)).toEqual([
      'subjects',
      'cadence',
      'submits',
      'decision',
    ]);
  });
});

describe('canAdvance', () => {
  it('holds the type step until a type is picked', () => {
    expect(canAdvance(answers({ step: 2 }))).toBe(false);
    expect(canAdvance(answers({ step: 2, type: 'pb' }))).toBe(true);
  });

  // The grant pathway has two screens on step 3, and the shape answer must not
  // satisfy the screen that asks who decides.
  it('checks step 3 against the screen showing, not the step', () => {
    const shaped = answers({
      step: 3,
      type: 'grant',
      shape: 'single',
      screen: 'grantDecision',
    });

    expect(canAdvance(shaped)).toBe(false);
    expect(canAdvance({ ...shaped, grantDecision: 'rubric' })).toBe(true);
  });

  it('holds the last step until the name is long enough', () => {
    expect(canAdvance(answers({ step: TOTAL_STEPS, name: '  ab  ' }))).toBe(
      false,
    );
    expect(canAdvance(answers({ step: TOTAL_STEPS, name: ' abc ' }))).toBe(
      true,
    );
  });

  it('lets the mapping walkthrough through — there is nothing to answer', () => {
    expect(canAdvance(answers({ step: 4 }))).toBe(true);
  });
});

describe('progressPercent', () => {
  // Step 3's sub-steps have to advance the bar, or it sticks for up to five
  // questions on the "other" pathway.
  it('moves through step 3 rather than sticking', () => {
    expect(progressPercent(3, 0, 4)).toBeLessThan(progressPercent(3, 1, 4));
    expect(progressPercent(3, 3, 4)).toBe(progressPercent(3, 0, 1));
  });

  it('fills the bar on the last step', () => {
    expect(progressPercent(TOTAL_STEPS, 0, 1)).toBe(100);
  });
});
