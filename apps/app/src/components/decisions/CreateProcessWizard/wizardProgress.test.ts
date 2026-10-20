import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_OTHER } from './otherFlow';
import type { WizardFlags } from './types';
import {
  clearWizardProgress,
  readWizardProgress,
  resumableProgress,
  saveWizardProgress,
  type WizardProgress,
} from './wizardProgress';

vi.mock('@op/logging/client', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ROLLING: WizardFlags = { rollingDecisions: true };
const NO_ROLLING: WizardFlags = { rollingDecisions: false };

const progress: WizardProgress = {
  screen: 'cadence',
  answers: {
    type: 'other',
    shape: 'custom',
    grantDecision: null,
    other: { ...EMPTY_OTHER, subjects: ['ideas', 'else'], elseText: 'Murals' },
    name: '',
  },
};

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('wizard progress', () => {
  it('reads back what was saved', () => {
    saveWizardProgress(progress);

    expect(readWizardProgress(ROLLING)).toEqual(progress);
  });

  it('reads nothing once cleared', () => {
    saveWizardProgress(progress);
    clearWizardProgress();

    expect(readWizardProgress(ROLLING)).toBeNull();
  });

  it('discards saved progress that no longer fits the wizard', () => {
    store.set(
      'create-process-wizard',
      JSON.stringify({
        ...progress,
        answers: { ...progress.answers, type: 'retired' },
      }),
    );

    expect(readWizardProgress(ROLLING)).toBeNull();
  });

  it('discards saved progress that is not JSON', () => {
    store.set('create-process-wizard', '{');

    expect(readWizardProgress(ROLLING)).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });

    expect(() => saveWizardProgress(progress)).not.toThrow();
    expect(() => clearWizardProgress()).not.toThrow();
    expect(readWizardProgress(ROLLING)).toBeNull();
  });
});

describe('resumableProgress', () => {
  const pbAnswered: WizardProgress = {
    screen: 'name',
    answers: {
      type: 'pb',
      shape: 'ideas',
      grantDecision: null,
      other: EMPTY_OTHER,
      name: 'Neighbourhood fund',
    },
  };

  it('resumes where the creator left off when every answer is there', () => {
    expect(resumableProgress(pbAnswered, ROLLING)).toEqual(pbAnswered);
  });

  it('sends a creator with no process type back to choosing one', () => {
    expect(
      resumableProgress(
        {
          ...pbAnswered,
          answers: { ...pbAnswered.answers, type: null },
        },
        ROLLING,
      ),
    ).toMatchObject({ screen: 'type' });
  });

  it("drops a shape that isn't one of the type's and asks for it again", () => {
    expect(
      resumableProgress(
        {
          ...pbAnswered,
          answers: { ...pbAnswered.answers, shape: 'loi' },
        },
        ROLLING,
      ),
    ).toMatchObject({ screen: 'shape', answers: { shape: null } });
  });

  it('stops at the first unanswered question inside step three', () => {
    expect(
      resumableProgress(
        {
          screen: 'mapping',
          answers: {
            ...progress.answers,
            other: { ...progress.answers.other, cadence: 'ongoing' },
          },
        },
        ROLLING,
      ),
    ).toMatchObject({ screen: 'submits' });
  });

  it('pulls a screen these answers do not ask back to the one before it', () => {
    expect(
      resumableProgress({ ...pbAnswered, screen: 'grantDecision' }, ROLLING),
    ).toMatchObject({ screen: 'shape' });
  });

  it('forgets a saved always-open answer and its screen once rolling decisions are off', () => {
    const resumed = resumableProgress(
      {
        screen: 'cadence',
        answers: {
          ...progress.answers,
          other: { ...progress.answers.other, cadence: 'ongoing' },
        },
      },
      NO_ROLLING,
    );

    expect(resumed).toMatchObject({
      screen: 'subjects',
      answers: { other: { cadence: null } },
    });
  });
});
