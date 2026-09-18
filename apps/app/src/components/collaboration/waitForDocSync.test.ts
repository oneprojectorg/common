import { describe, expect, it } from 'vitest';

import { isDocSynced, waitForDocSync } from './waitForDocSync';

type ProviderMock = { synced: boolean; hasUnsyncedChanges: boolean };

function makeProvider(overrides: Partial<ProviderMock> = {}): ProviderMock {
  return { synced: false, hasUnsyncedChanges: true, ...overrides };
}

describe('isDocSynced', () => {
  it('returns true for a null provider (no collab doc to sync)', () => {
    expect(isDocSynced(null)).toBe(true);
    expect(isDocSynced(undefined)).toBe(true);
  });

  it('returns false while the provider has not finished its initial sync', () => {
    expect(
      isDocSynced(makeProvider({ synced: false, hasUnsyncedChanges: false })),
    ).toBe(false);
  });

  it('returns false while local updates await the server ack', () => {
    expect(
      isDocSynced(makeProvider({ synced: true, hasUnsyncedChanges: true })),
    ).toBe(false);
  });

  it('returns true once synced with nothing pending', () => {
    expect(
      isDocSynced(makeProvider({ synced: true, hasUnsyncedChanges: false })),
    ).toBe(true);
  });
});

describe('waitForDocSync', () => {
  it('resolves true immediately for a null provider', async () => {
    const start = Date.now();
    await expect(waitForDocSync(null, { timeoutMs: 500 })).resolves.toBe(true);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('resolves true immediately when already synced', async () => {
    const start = Date.now();
    const provider = makeProvider({ synced: true, hasUnsyncedChanges: false });
    await expect(waitForDocSync(provider, { timeoutMs: 500 })).resolves.toBe(
      true,
    );
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('resolves true when the provider syncs during the wait', async () => {
    const provider = makeProvider();
    setTimeout(() => {
      provider.synced = true;
      provider.hasUnsyncedChanges = false;
    }, 50);

    await expect(
      waitForDocSync(provider, { timeoutMs: 2_000, pollMs: 10 }),
    ).resolves.toBe(true);
  });

  it('resolves false when the provider never syncs within the timeout', async () => {
    const provider = makeProvider();
    await expect(
      waitForDocSync(provider, { timeoutMs: 150, pollMs: 20 }),
    ).resolves.toBe(false);
  });
});
