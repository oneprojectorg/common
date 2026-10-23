import { PROCESS_NAME_MAX_LENGTH } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_ANSWERS,
  INITIAL_STATE,
  TOTAL_STEPS,
  isScreenComplete,
  nextScreen,
  previousScreen,
  progressPercent,
  resumeWizard,
  screensFor,
  settleAnswers,
  shapeOf,
  stepOf,
  wizardReducer,
  type ScreenId,
  type WizardAnswers,
  type WizardState,
} from './flow';

const answers = (patch: Partial<WizardAnswers>): WizardAnswers => ({
  ...EMPTY_ANSWERS,
  ...patch,
});

const at = (screen: ScreenId, state: WizardAnswers): WizardState => ({
  screen,
  answers: state,
});

const timeline = answers({
  type: 'other',
  subject: { kind: 'funding' },
  cadence: 'timeline',
  submits: 'applications',
  decision: 'vote',
});

const ongoing = answers({ ...timeline, cadence: 'ongoing', decision: null });

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
      'subject',
      'cadence',
      'submits',
      'decision',
      'mapping',
      'name',
    ]);
  });

  it('skips the decision question once the process has no end', () => {
    expect(screensFor(ongoing)).toEqual([
      'intro',
      'type',
      'subject',
      'cadence',
      'submits',
      'mapping',
      'name',
    ]);
  });

  it('asks no step 3 questions before a type is picked', () => {
    expect(screensFor(EMPTY_ANSWERS).map(stepOf)).not.toContain(3);
  });

  it('reaches every screen from some set of answers, once each', () => {
    const reached = [
      answers({ type: 'grant' }),
      answers({ type: 'pb' }),
      timeline,
    ].flatMap(screensFor);

    expect(new Set(reached)).toEqual(
      new Set([
        'intro',
        'type',
        'shape',
        'grantDecision',
        'subject',
        'cadence',
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

  it('skips the decision screen when it is not asked', () => {
    expect(nextScreen('submits', ongoing)).toBe('mapping');
    expect(previousScreen('mapping', ongoing)).toBe('submits');
    expect(nextScreen('submits', timeline)).toBe('decision');
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

  it('needs words for something else', () => {
    const picked = answers({
      type: 'other',
      subject: { kind: 'else', text: '' },
    });

    expect(isScreenComplete('subject', EMPTY_ANSWERS)).toBe(false);
    expect(isScreenComplete('subject', picked)).toBe(false);
    expect(
      isScreenComplete('subject', {
        ...picked,
        subject: { kind: 'else', text: '   ' },
      }),
    ).toBe(false);
    expect(
      isScreenComplete('subject', {
        ...picked,
        subject: { kind: 'else', text: 'A new logo' },
      }),
    ).toBe(true);
    expect(isScreenComplete('subject', timeline)).toBe(true);
  });

  it.each(['cadence', 'submits', 'decision'] as const)(
    'needs an answer to %s',
    (screen) => {
      expect(isScreenComplete(screen, answers({ type: 'other' }))).toBe(false);
      expect(isScreenComplete(screen, timeline)).toBe(true);
    },
  );

  it('holds the name screen until the name is long enough', () => {
    expect(isScreenComplete('name', answers({ name: '  ab  ' }))).toBe(false);
    expect(isScreenComplete('name', answers({ name: ' abc ' }))).toBe(true);
  });

  it('holds the name screen when the name is longer than the API accepts', () => {
    const longest = 'a'.repeat(PROCESS_NAME_MAX_LENGTH);

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
    ['with', timeline],
    ['without', ongoing],
  ])(
    'only moves forward through step 3, %s the decision screen',
    (_, other) => {
      const bar = screensFor(other)
        .filter((screen) => stepOf(screen) === 3)
        .map((screen) => progressPercent(screen, 'other'));

      expect(bar).toEqual([...bar].sort((a, b) => a - b));
      expect(new Set(bar).size).toBe(bar.length);
      expect(bar[0]).toBeGreaterThan(progressPercent('type', 'other'));
    },
  );

  it('fills step 3 only on its last possible screen', () => {
    expect(progressPercent('decision', 'other')).toBe((3 / TOTAL_STEPS) * 100);
    expect(progressPercent('submits', 'other')).toBeLessThan(
      (3 / TOTAL_STEPS) * 100,
    );
  });

  it('fills the bar on the last step', () => {
    expect(progressPercent('name', null)).toBe(100);
  });
});

describe('shapeOf', () => {
  it('composes the other pathway’s shape instead of asking for one', () => {
    expect(shapeOf(timeline)).toBe('custom');
    expect(shapeOf(answers({ type: 'grant', shape: 'loi' }))).toBe('loi');
  });
});

describe('settleAnswers', () => {
  it('drops a shape the new type does not offer', () => {
    expect(
      settleAnswers(answers({ type: 'pb', shape: 'loi' })).shape,
    ).toBeNull();
    expect(settleAnswers(answers({ type: 'grant', shape: 'loi' })).shape).toBe(
      'loi',
    );
  });

  it('keeps who decides for grantmaking only', () => {
    expect(
      settleAnswers(answers({ type: 'grant', grantDecision: 'hybrid' }))
        .grantDecision,
    ).toBe('hybrid');
    expect(
      settleAnswers(answers({ type: 'pb', grantDecision: 'hybrid' }))
        .grantDecision,
    ).toBeNull();
  });

  it('empties the other answers once another type is picked', () => {
    expect(settleAnswers({ ...timeline, type: 'pb' }, timeline)).toEqual(
      answers({ type: 'pb' }),
    );
  });

  it('drops the decision once the process has no end', () => {
    expect(
      settleAnswers({ ...timeline, cadence: 'ongoing' }, timeline).decision,
    ).toBeNull();
  });

  it('drops a submission the subject does not offer, with nothing to compare against', () => {
    expect(
      settleAnswers({ ...timeline, submits: 'nominations' }).submits,
    ).toBeNull();
    expect(settleAnswers(timeline).submits).toBe('applications');
  });

  it('drops what is submitted when the subject changes, even to one offering the same key', () => {
    expect(
      settleAnswers({ ...timeline, subject: { kind: 'people' } }, timeline)
        .submits,
    ).toBeNull();
  });

  it('keeps what is submitted when the subject is picked again', () => {
    expect(settleAnswers(timeline, timeline).submits).toBe('applications');
  });

  it('keeps every answer when the same type is picked again', () => {
    const answered = answers({
      type: 'grant',
      shape: 'single',
      grantDecision: 'applicants',
    });

    expect(settleAnswers(answered, answered)).toEqual(answered);
  });
});

describe('wizardReducer', () => {
  it('settles each answer against the ones before it', () => {
    const state = wizardReducer(at('subject', timeline), {
      type: 'answer',
      patch: { subject: { kind: 'people' } },
    });

    expect(state.screen).toBe('subject');
    expect(state.answers.subject).toEqual({ kind: 'people' });
    expect(state.answers.submits).toBeNull();
  });

  it('holds the screen until it is complete', () => {
    expect(wizardReducer(INITIAL_STATE, { type: 'next' }).screen).toBe('type');
    expect(
      wizardReducer(at('type', EMPTY_ANSWERS), { type: 'next' }).screen,
    ).toBe('type');
  });

  it('walks forward and back through the screens these answers ask', () => {
    expect(wizardReducer(at('submits', ongoing), { type: 'next' }).screen).toBe(
      'mapping',
    );
    expect(wizardReducer(at('mapping', ongoing), { type: 'back' }).screen).toBe(
      'submits',
    );
  });

  it('stays put at either end', () => {
    expect(wizardReducer(INITIAL_STATE, { type: 'back' })).toBe(INITIAL_STATE);

    const last = at('name', { ...timeline, name: 'Grants 2026' });

    expect(wizardReducer(last, { type: 'next' })).toBe(last);
  });
});

describe('resumeWizard', () => {
  it('resumes where the creator left off when every answer is there', () => {
    expect(resumeWizard(at('mapping', timeline)).screen).toBe('mapping');
  });

  it('sends a creator with no process type back to choosing one', () => {
    expect(
      resumeWizard(at('mapping', answers({ shape: 'single' }))).screen,
    ).toBe('type');
  });

  it("drops a shape that isn't one of the type's and asks for it again", () => {
    const resumed = resumeWizard(
      at('grantDecision', answers({ type: 'pb', shape: 'loi' })),
    );

    expect(resumed.answers.shape).toBeNull();
    expect(resumed.screen).toBe('shape');
  });

  it('stops at the first unanswered question inside step three', () => {
    expect(
      resumeWizard(at('name', { ...timeline, submits: null })).screen,
    ).toBe('submits');
  });

  it('pulls a screen these answers do not ask back to the one before it', () => {
    expect(resumeWizard(at('decision', ongoing)).screen).toBe('submits');
  });
});
