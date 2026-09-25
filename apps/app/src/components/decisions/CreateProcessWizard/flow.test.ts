import { describe, expect, it } from 'vitest';

import {
  TOTAL_STEPS,
  canAdvance,
  progressPercent,
  stepThreeScreens,
  type WizardAnswers,
} from './flow';
import { EMPTY_OTHER, type OtherAnswers } from './otherFlow';

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
  // With and without the focus screen, which an answer can add mid-step.
  const withFocus: OtherAnswers = {
    ...EMPTY_OTHER,
    subjects: ['funding', 'ideas'],
    cadence: 'timeline',
  };

  it.each([
    ['with', withFocus],
    ['without', EMPTY_OTHER],
  ])('only moves forward through step 3, %s the focus screen', (_, other) => {
    const bar = stepThreeScreens('other', other).map((screen) =>
      progressPercent(3, screen, 'other'),
    );

    expect(bar).toEqual([...bar].sort((a, b) => a - b));
    expect(new Set(bar).size).toBe(bar.length);
    expect(bar[0]).toBeGreaterThan(progressPercent(2, 'shape', 'other'));
    expect(bar.at(-1)).toBe((3 / TOTAL_STEPS) * 100);
  });

  it('fills the bar on the last step', () => {
    expect(progressPercent(TOTAL_STEPS, 'shape', null)).toBe(100);
  });
});
