import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/lib/i18n';

vi.mock('@op/sense/Toast', () => ({
  toast: { error: vi.fn() },
}));

import { toast } from '@op/sense/Toast';

import { ensureRestoreSynced } from './ensureRestoreSynced';

type ProviderMock = { synced: boolean; hasUnsyncedChanges: boolean };

function makeProvider(overrides: Partial<ProviderMock> = {}): ProviderMock {
  return { synced: false, hasUnsyncedChanges: true, ...overrides };
}

const t = ((key: string) => key) as unknown as TranslateFn;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureRestoreSynced', () => {
  it('resolves true and shows no toast for a null provider', async () => {
    await expect(ensureRestoreSynced(null, t)).resolves.toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('resolves true and shows no toast when already synced', async () => {
    const provider = makeProvider({ synced: true, hasUnsyncedChanges: false });

    await expect(ensureRestoreSynced(provider, t)).resolves.toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('resolves true once the provider syncs during the wait', async () => {
    const provider = makeProvider();
    setTimeout(() => {
      provider.synced = true;
      provider.hasUnsyncedChanges = false;
    }, 20);

    await expect(
      ensureRestoreSynced(provider, t, { timeoutMs: 2_000, pollMs: 10 }),
    ).resolves.toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('resolves false and toasts a sync-pending message when the provider never syncs', async () => {
    const provider = makeProvider();

    await expect(
      ensureRestoreSynced(provider, t, { timeoutMs: 100, pollMs: 20 }),
    ).resolves.toBe(false);

    expect(toast.error).toHaveBeenCalledWith('Your changes are still syncing', {
      description: 'Please wait a moment and try again.',
    });
  });
});
