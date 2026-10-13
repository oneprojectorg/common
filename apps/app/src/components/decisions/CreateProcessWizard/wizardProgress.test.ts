import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_OTHER } from './otherFlow';
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

    expect(readWizardProgress()).toEqual(progress);
  });

  it('reads nothing once cleared', () => {
    saveWizardProgress(progress);
    clearWizardProgress();

    expect(readWizardProgress()).toBeNull();
  });

  it('discards saved progress that no longer fits the wizard', () => {
    store.set(
      'create-process-wizard',
      JSON.stringify({
        ...progress,
        answers: { ...progress.answers, type: 'retired' },
      }),
    );

    expect(readWizardProgress()).toBeNull();
  });

  it('discards saved progress that is not JSON', () => {
    store.set('create-process-wizard', '{');

    expect(readWizardProgress()).toBeNull();
  });

  it('keeps working in memory when storage throws', () => {
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
    expect(readWizardProgress()).toBeNull();
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
    expect(resumableProgress(pbAnswered)).toEqual(pbAnswered);
  });

  it('sends a creator with no process type back to choosing one', () => {
    expect(
      resumableProgress({
        ...pbAnswered,
        answers: { ...pbAnswered.answers, type: null },
      }),
    ).toMatchObject({ screen: 'type' });
  });

  it("drops a shape that isn't one of the type's and asks for it again", () => {
    expect(
      resumableProgress({
        ...pbAnswered,
        answers: { ...pbAnswered.answers, shape: 'loi' },
      }),
    ).toMatchObject({ screen: 'shape', answers: { shape: null } });
  });

  it('stops at the first unanswered question inside step three', () => {
    expect(
      resumableProgress({
        screen: 'mapping',
        answers: {
          ...progress.answers,
          other: { ...progress.answers.other, cadence: 'ongoing' },
        },
      }),
    ).toMatchObject({ screen: 'submits' });
  });

  it('pulls a screen these answers do not ask back to the one before it', () => {
    expect(
      resumableProgress({ ...pbAnswered, screen: 'grantDecision' }),
    ).toMatchObject({ screen: 'shape' });
  });
});
