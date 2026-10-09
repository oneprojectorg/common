import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_OTHER } from './otherFlow';
import {
  clearWizardProgress,
  readWizardProgress,
  saveWizardProgress,
  type WizardProgress,
} from './wizardProgress';

vi.mock('@op/logging/client', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const progress: WizardProgress = {
  step: 3,
  subIndex: 1,
  type: 'other',
  shape: 'custom',
  grantDecision: null,
  other: { ...EMPTY_OTHER, subjects: ['ideas', 'else'], elseText: 'Murals' },
  name: '',
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
      JSON.stringify({ ...progress, type: 'retired' }),
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
