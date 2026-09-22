import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/**
 * `TRPCProvider` persists the React Query cache to `localStorage` with a manual
 * `buster`. When the dehydrated payload's shape moves — as it did across the
 * React Query 5.66 -> 5.102 upgrade — the buster must move with it, or a
 * returning user restores entries the new code cannot read.
 *
 * This cannot be hand-tested in a Vercel preview: `localStorage` is per-origin
 * and every branch gets its own preview origin, so a reviewer always arrives
 * with an empty cache and the discard path never runs. The spec seeds the entry
 * instead.
 */
const OFFLINE_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/** The buster in use before the React Query 5.102 upgrade. */
const PREVIOUS_BUSTER = 'list-items-envelope-1';

/**
 * A marker that only a rehydrated entry can carry. It is parked under a
 * procedure the pages below never call, so no refetch can overwrite it: if the
 * entry is restored it survives into the next dehydrate, and if the entry is
 * discarded it is gone for good. That makes "was the stale payload dropped?"
 * a deterministic question rather than a race against the first refetch.
 */
const STALE_SENTINEL = 'stale-buster-sentinel-value';

function stalePersistedClient(): string {
  return JSON.stringify({
    buster: PREVIOUS_BUSTER,
    timestamp: Date.now(),
    clientState: {
      mutations: [],
      queries: [
        {
          queryKey: [
            ['organization', 'getRoles'],
            { input: { organizationId: STALE_SENTINEL }, type: 'query' },
          ],
          queryHash: `[["organization","getRoles"],{"input":{"organizationId":"${STALE_SENTINEL}"},"type":"query"}]`,
          state: {
            data: { items: [{ id: STALE_SENTINEL, name: STALE_SENTINEL }] },
            dataUpdateCount: 1,
            dataUpdatedAt: Date.now(),
            error: null,
            errorUpdateCount: 0,
            errorUpdatedAt: 0,
            fetchFailureCount: 0,
            fetchFailureReason: null,
            fetchMeta: null,
            isInvalidated: false,
            status: 'success',
            fetchStatus: 'idle',
          },
        },
      ],
    },
  });
}

const readOfflineCache = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), OFFLINE_CACHE_KEY);

test.describe('Persisted query cache buster', () => {
  test('discards an entry written under the previous buster', async ({
    page,
  }) => {
    // An init script so the entry is in place before any app JS runs, which is
    // when `PersistQueryClientProvider` reads it.
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: OFFLINE_CACHE_KEY, value: stalePersistedClient() },
    );

    await page.goto('/en/decisions');
    await expect(page.getByTestId('user-menu-trigger')).toBeVisible({
      timeout: 20_000,
    });

    // A discarded entry is first removed and only later rewritten under the new
    // buster, so both states are correct — what must never happen is the old
    // buster surviving, which is what a restore would leave behind.
    await expect
      .poll(
        async () => {
          const raw = await readOfflineCache(page);
          return raw === null ? null : JSON.parse(raw).buster;
        },
        { timeout: 20_000 },
      )
      .not.toBe(PREVIOUS_BUSTER);

    // And the stale payload is gone rather than carried into the new entry.
    expect((await readOfflineCache(page)) ?? '').not.toContain(STALE_SENTINEL);

    // And it never reached the UI.
    await expect(page.getByText(STALE_SENTINEL)).toHaveCount(0);
  });
});
