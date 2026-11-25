// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { useSavePhase } from './useSavePhase';

interface Hook {
  onSuccess?: (saved: { id: string; name: string }) => Promise<void>;
}

const { captured, utils } = vi.hoisted(() => {
  const captured: { hook: Hook; cached: unknown } = { hook: {}, cached: null };
  const utils = {
    decision: {
      getDecisionBySlug: {
        setData: vi.fn(
          (_input: unknown, update: (current: unknown) => unknown) => {
            captured.cached = update(captured.cached);
          },
        ),
        invalidate: vi.fn(async () => {}),
      },
    },
  };

  return { captured, utils };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => utils,
    decision: {
      updatePhase: {
        useMutation: (hook: Hook) => {
          captured.hook = hook;
          return {};
        },
      },
    },
  },
}));
vi.mock('@op/sense/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {children}
  </NextIntlClientProvider>
);

describe('useSavePhase', () => {
  it('renames the saved phase in both cached phase lists', async () => {
    captured.cached = {
      name: 'Community Fund',
      processInstance: {
        phases: [
          { id: 'row-review', phaseId: 'review', name: 'Review' },
          { id: 'row-vote', phaseId: 'vote', name: 'Vote' },
        ],
        instanceData: {
          phases: [
            { phaseId: 'review', name: 'Review' },
            { phaseId: 'vote', name: 'Vote' },
          ],
        },
      },
    };
    renderHook(() => useSavePhase('community-fund'), { wrapper });

    await captured.hook.onSuccess?.({ id: 'row-review', name: 'Shortlist' });

    expect(captured.cached).toEqual({
      name: 'Community Fund',
      processInstance: {
        phases: [
          { id: 'row-review', phaseId: 'review', name: 'Shortlist' },
          { id: 'row-vote', phaseId: 'vote', name: 'Vote' },
        ],
        instanceData: {
          phases: [
            { phaseId: 'review', name: 'Shortlist' },
            { phaseId: 'vote', name: 'Vote' },
          ],
        },
      },
    });
    expect(utils.decision.getDecisionBySlug.invalidate).toHaveBeenCalled();
  });
});
