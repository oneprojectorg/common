import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import rateLimited, { trackedWindowCount } from './rateLimited';

const URL = 'https://api.example.org/trpc/organization.getBySlug';

// `rateLimited` keeps its windows in module state, so each test starts far
// enough ahead of the last that everything the previous one left behind has
// expired — the clock never runs backwards between tests.
let clock = 1_800_000_000_000;

describe('rateLimited', () => {
  beforeEach(() => {
    clock += 10_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(clock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit and blocks the next one', () => {
    const ip = '203.0.113.1';

    expect(rateLimited(ip, URL, 10, 3).status).toBe(false);
    expect(rateLimited(ip, URL, 10, 3).status).toBe(false);
    expect(rateLimited(ip, URL, 10, 3).status).toBe(false);
    expect(rateLimited(ip, URL, 10, 3).status).toBe(true);
  });

  it('counts each path separately', () => {
    const ip = '203.0.113.2';

    expect(rateLimited(ip, URL, 10, 1).status).toBe(false);
    expect(rateLimited(ip, `${URL}.other`, 10, 1).status).toBe(false);
  });

  it('starts a fresh window once the current one elapses', () => {
    const ip = '203.0.113.3';

    expect(rateLimited(ip, URL, 10, 1).status).toBe(false);
    expect(rateLimited(ip, URL, 10, 1).status).toBe(true);

    vi.advanceTimersByTime(10_001);

    expect(rateLimited(ip, URL, 10, 1).status).toBe(false);
  });

  it('reports the time left in the current window', () => {
    const ip = '203.0.113.4';

    expect(rateLimited(ip, URL, 10, 2).timeToRefresh).toBe(10_000);

    vi.advanceTimersByTime(4_000);

    expect(rateLimited(ip, URL, 10, 2).timeToRefresh).toBe(6_000);
  });

  it('drops a caller once its window expires rather than retaining the IP', () => {
    // The first call sweeps whatever the earlier tests left behind.
    rateLimited('203.0.113.5', URL, 10, 10);
    rateLimited('203.0.113.6', URL, 10, 10);

    expect(trackedWindowCount()).toBe(2);

    // Past the window and past the sweep cadence: the next call collects them.
    vi.advanceTimersByTime(120_000);
    rateLimited('203.0.113.7', URL, 10, 10);

    expect(trackedWindowCount()).toBe(1);
  });

  it('keeps a window that a longer-lived limit is still counting against', () => {
    const ip = '203.0.113.8';

    // A 10-minute limit must survive the sweeps a 10-second one triggers.
    expect(rateLimited(ip, URL, 600, 1).status).toBe(false);

    vi.advanceTimersByTime(120_000);
    rateLimited('203.0.113.9', URL, 10, 10);

    expect(rateLimited(ip, URL, 600, 1).status).toBe(true);
  });
});
