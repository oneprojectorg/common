// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useManualAwardDraft } from './useManualAwardDraft';

const INSTANCE = 'instance-award-draft';
const KEY = `@op/manual-awards:${INSTANCE}:final`;

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe('useManualAwardDraft', () => {
  it('starts empty and keeps an edit across a remount', () => {
    const first = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    expect(first.result.current[0]).toEqual({});

    act(() => first.result.current[1]({ solar: 3000, bike: null }));
    first.unmount();

    const second = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    expect(second.result.current[0]).toEqual({ solar: 3000, bike: null });
  });

  it('keeps one draft per instance and phase', () => {
    const final = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    const review = renderHook(() => useManualAwardDraft(INSTANCE, 'review'));

    act(() => final.result.current[1]({ solar: 3000 }));

    expect(review.result.current[0]).toEqual({});
  });

  it('shares a write with another hook on the same key in this tab', () => {
    const table = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    const footer = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));

    act(() => table.result.current[1]({ solar: 3000 }));

    expect(footer.result.current[0]).toEqual({ solar: 3000 });
  });

  it('follows a write from another tab', () => {
    const { result } = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));

    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify({ bike: 8200.5 }));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(result.current[0]).toEqual({ bike: 8200.5 });
  });

  it('reads what another tab wrote while this tab had the page closed', () => {
    const first = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    act(() => first.result.current[1]({ solar: 3000 }));
    first.unmount();

    window.localStorage.setItem(KEY, JSON.stringify({ solar: 2500 }));

    const second = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    expect(second.result.current[0]).toEqual({ solar: 2500 });

    act(() =>
      second.result.current[1]({ ...second.result.current[0], bike: 100 }),
    );
    expect(window.localStorage.getItem(KEY)).toBe(
      JSON.stringify({ solar: 2500, bike: 100 }),
    );
  });

  it('drops its draft when another tab clears the whole storage', () => {
    const { result } = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    act(() => result.current[1]({ solar: 3000 }));

    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });

    expect(result.current[0]).toEqual({});
  });

  it('removes the key when the draft is emptied', () => {
    const { result } = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));

    act(() => result.current[1]({ solar: 3000 }));
    expect(window.localStorage.getItem(KEY)).toBe(
      JSON.stringify({ solar: 3000 }),
    );

    act(() => result.current[1]({}));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current[0]).toEqual({});
  });

  it('reads a corrupt or foreign value as an empty draft', () => {
    window.localStorage.setItem(KEY, '{not json');
    const corrupt = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    expect(corrupt.result.current[0]).toEqual({});

    window.localStorage.setItem(
      KEY,
      JSON.stringify({ solar: '3000', bike: 100, garden: null, list: [1] }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    const foreign = renderHook(() => useManualAwardDraft(INSTANCE, 'final'));
    expect(foreign.result.current[0]).toEqual({ bike: 100, garden: null });
  });
});
