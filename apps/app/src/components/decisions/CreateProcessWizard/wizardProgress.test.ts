import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_ANSWERS, type WizardState } from './flow';
import {
  clearWizardOrigin,
  clearWizardProgress,
  readWizardProgress,
  saveWizardOrigin,
  saveWizardProgress,
  takeWizardOrigin,
} from './wizardProgress';

vi.mock('@op/logging/client', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const progress: WizardState = {
  screen: 'cadence',
  answers: {
    ...EMPTY_ANSWERS,
    type: 'other',
    subject: 'else',
    subjectText: 'Murals',
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

  it('discards a subject saved by the multi-select wizard', () => {
    store.set(
      'create-process-wizard',
      JSON.stringify({
        ...progress,
        answers: { ...progress.answers, subject: ['ideas', 'else'] },
      }),
    );

    expect(readWizardProgress()).toBeNull();
  });

  it('pulls saved progress back to the first unanswered question', () => {
    saveWizardProgress({ ...progress, screen: 'mapping' });

    expect(readWizardProgress()).toMatchObject({ screen: 'cadence' });
  });

  it('discards saved progress that is not JSON', () => {
    store.set('create-process-wizard', '{');

    expect(readWizardProgress()).toBeNull();
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
    expect(readWizardProgress()).toBeNull();
  });
});

describe('wizard origin', () => {
  it('hands the origin back once', () => {
    saveWizardOrigin('/org/acme');

    expect(takeWizardOrigin()).toBe('/org/acme');
    expect(takeWizardOrigin()).toBeNull();
  });

  it('hands nothing back once cleared', () => {
    saveWizardOrigin('/org/acme');
    clearWizardOrigin();

    expect(takeWizardOrigin()).toBeNull();
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

    expect(() => saveWizardOrigin('/org/acme')).not.toThrow();
    expect(() => clearWizardOrigin()).not.toThrow();
    expect(takeWizardOrigin()).toBeNull();
  });
});
