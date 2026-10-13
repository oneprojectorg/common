import { describe, expect, it } from 'vitest';

import { MAX_PROCESS_NAME_LENGTH } from './content';
import {
  EMPTY_ANSWERS,
  TOTAL_STEPS,
  isScreenComplete,
  nextScreen,
  previousScreen,
  progressPercent,
  reconcileAnswers,
  screensFor,
  stepOf,
  type ScreenId,
  type WizardAnswers,
} from './flow';
import { EMPTY_OTHER, type OtherAnswers } from './otherFlow';

const answers = (patch: Partial<WizardAnswers>): WizardAnswers => ({
  ...EMPTY_ANSWERS,
  ...patch,
});

const withFocus: OtherAnswers = {
  ...EMPTY_OTHER,
  subjects: ['funding', 'ideas'],
  cadence: 'timeline',
};

describe('screensFor', () => {
  it('asks grantmaking who decides, after the shape', () => {
    expect(screensFor(answers({ type: 'grant' }))).toEqual([
      'intro',
      'type',
      'shape',
      'grantDecision',
      'mapping',
      'name',
    ]);
  });

  it('asks budgeting for the shape alone', () => {
    expect(screensFor(answers({ type: 'pb' }))).toEqual([
      'intro',
      'type',
      'shape',
      'mapping',
      'name',
    ]);
  });

  it('hands the other pathway its own questions', () => {
    expect(screensFor(answers({ type: 'other' }))).toEqual([
      'intro',
      'type',
      'subjects',
      'cadence',
      'submits',
      'decision',
      'mapping',
      'name',
    ]);
  });

  it('asks which subject to focus on, after cadence, only for several subjects on a timeline', () => {
    const screens = screensFor(answers({ type: 'other', other: withFocus }));

    expect(screens.indexOf('focus')).toBe(screens.indexOf('cadence') + 1);
    expect(
      screensFor(
        answers({
          type: 'other',
          other: { ...withFocus, cadence: 'ongoing' },
        }),
      ),
    ).not.toContain('focus');
    expect(
      screensFor(
        answers({
          type: 'other',
          other: { ...withFocus, subjects: ['funding'] },
        }),
      ),
    ).not.toContain('focus');
  });

  it('asks no step 3 questions before a type is picked', () => {
    expect(screensFor(EMPTY_ANSWERS).map(stepOf)).not.toContain(3);
  });

  it('reaches every screen from some set of answers, once each', () => {
    const reached = [
      answers({ type: 'grant' }),
      answers({ type: 'pb' }),
      answers({ type: 'other', other: withFocus }),
    ].flatMap(screensFor);

    expect(new Set(reached)).toEqual(
      new Set([
        'intro',
        'type',
        'shape',
        'grantDecision',
        'subjects',
        'cadence',
        'focus',
        'submits',
        'decision',
        'mapping',
        'name',
      ]),
    );
  });
});

describe('nextScreen and previousScreen', () => {
  it('walk the screens these answers ask', () => {
    const grant = answers({ type: 'grant' });
    const screens = screensFor(grant);
    const walked: ScreenId[] = ['intro'];

    for (
      let screen = nextScreen('intro', grant);
      screen;
      screen = nextScreen(screen, grant)
    ) {
      walked.push(screen);
    }

    expect(walked).toEqual(screens);
    expect(previousScreen('mapping', grant)).toBe('grantDecision');
  });

  it('skips the focus screen when it is not asked', () => {
    const other = answers({ type: 'other', other: EMPTY_OTHER });

    expect(nextScreen('cadence', other)).toBe('submits');
    expect(previousScreen('submits', other)).toBe('cadence');
    expect(
      nextScreen('cadence', answers({ type: 'other', other: withFocus })),
    ).toBe('focus');
  });

  it('stops at either end', () => {
    expect(previousScreen('intro', EMPTY_ANSWERS)).toBeNull();
    expect(nextScreen('name', EMPTY_ANSWERS)).toBeNull();
  });
});

describe('isScreenComplete', () => {
  it('holds the type screen until a type is picked', () => {
    expect(isScreenComplete('type', EMPTY_ANSWERS)).toBe(false);
    expect(isScreenComplete('type', answers({ type: 'pb' }))).toBe(true);
  });

  it('checks the screen showing, not the step', () => {
    const shaped = answers({ type: 'grant', shape: 'single' });

    expect(isScreenComplete('shape', shaped)).toBe(true);
    expect(isScreenComplete('grantDecision', shaped)).toBe(false);
    expect(
      isScreenComplete('grantDecision', { ...shaped, grantDecision: 'rubric' }),
    ).toBe(true);
  });

  it('holds the name screen until the name is long enough', () => {
    expect(isScreenComplete('name', answers({ name: '  ab  ' }))).toBe(false);
    expect(isScreenComplete('name', answers({ name: ' abc ' }))).toBe(true);
  });

  it('holds the name screen when the name is longer than the API accepts', () => {
    const longest = 'a'.repeat(MAX_PROCESS_NAME_LENGTH);

    expect(isScreenComplete('name', answers({ name: ` ${longest} ` }))).toBe(
      true,
    );
    expect(isScreenComplete('name', answers({ name: `${longest}a` }))).toBe(
      false,
    );
  });

  it('lets the intro and mapping walkthrough through — there is nothing to answer', () => {
    expect(isScreenComplete('intro', EMPTY_ANSWERS)).toBe(true);
    expect(isScreenComplete('mapping', EMPTY_ANSWERS)).toBe(true);
  });
});

describe('progressPercent', () => {
  it.each([
    ['with', withFocus],
    ['without', EMPTY_OTHER],
  ])('only moves forward through step 3, %s the focus screen', (_, other) => {
    const bar = screensFor(answers({ type: 'other', other }))
      .filter((screen) => stepOf(screen) === 3)
      .map((screen) => progressPercent(screen, 'other'));

    expect(bar).toEqual([...bar].sort((a, b) => a - b));
    expect(new Set(bar).size).toBe(bar.length);
    expect(bar[0]).toBeGreaterThan(progressPercent('type', 'other'));
    expect(bar.at(-1)).toBe((3 / TOTAL_STEPS) * 100);
  });

  it('fills the bar on the last step', () => {
    expect(progressPercent('name', null)).toBe(100);
  });
});

describe('reconcileAnswers', () => {
  it('drops a shape the new type does not offer', () => {
    expect(
      reconcileAnswers(answers({ type: 'pb', shape: 'loi' })).shape,
    ).toBeNull();
    expect(
      reconcileAnswers(answers({ type: 'grant', shape: 'loi' })).shape,
    ).toBe('loi');
  });

  it('gives the other pathway its composed shape', () => {
    expect(
      reconcileAnswers(answers({ type: 'other', shape: 'single' })).shape,
    ).toBe('custom');
  });

  it('keeps who decides for grantmaking only', () => {
    expect(
      reconcileAnswers(answers({ type: 'grant', grantDecision: 'hybrid' }))
        .grantDecision,
    ).toBe('hybrid');
    expect(
      reconcileAnswers(answers({ type: 'pb', grantDecision: 'hybrid' }))
        .grantDecision,
    ).toBeNull();
  });

  it('empties the other answers once another type is picked', () => {
    expect(
      reconcileAnswers(answers({ type: 'pb', other: withFocus })).other,
    ).toEqual(EMPTY_OTHER);
  });

  it('drops the composed shape when the other pathway is left', () => {
    const other = answers({ type: 'other', shape: 'custom', other: withFocus });

    expect(
      reconcileAnswers({ ...other, type: 'grant' }, other).shape,
    ).toBeNull();
  });

  it('keeps every answer when the same type is picked again', () => {
    const answered = answers({
      type: 'grant',
      shape: 'single',
      grantDecision: 'applicants',
    });

    expect(reconcileAnswers(answered, answered)).toEqual(answered);
  });
});
