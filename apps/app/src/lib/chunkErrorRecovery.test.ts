import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isChunkLoadError, reloadForChunkError } from './chunkErrorRecovery';

describe('isChunkLoadError', () => {
  it('matches errors named ChunkLoadError', () => {
    const error = new Error('anything');
    error.name = 'ChunkLoadError';

    expect(isChunkLoadError(error)).toBe(true);
  });

  it('matches the webpack "Loading chunk N failed" message', () => {
    expect(isChunkLoadError(new Error('Loading chunk 1158 failed.'))).toBe(
      true,
    );
    expect(isChunkLoadError('Loading chunk 619 failed')).toBe(true);
  });

  it('matches failed CSS chunk loads', () => {
    expect(isChunkLoadError(new Error('Loading CSS chunk 42 failed'))).toBe(
      true,
    );
  });

  it('ignores unrelated errors and nullish values', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('reloadForChunkError', () => {
  let reload: ReturnType<typeof vi.fn>;
  let store: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    reload = vi.fn();
    store = new Map();
    vi.stubGlobal('window', {
      location: { reload },
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reloads once and records the attempt', () => {
    expect(reloadForChunkError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('suppresses a second reload within the cooldown window', () => {
    reloadForChunkError();
    vi.advanceTimersByTime(2_000);

    expect(reloadForChunkError()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again once the cooldown window has elapsed', () => {
    reloadForChunkError();
    vi.advanceTimersByTime(11_000);

    expect(reloadForChunkError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload when sessionStorage is unavailable', () => {
    vi.stubGlobal('window', {
      location: { reload },
      sessionStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });

    expect(reloadForChunkError()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
