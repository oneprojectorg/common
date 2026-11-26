// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { installMemoryStorage } from '../../testing/memoryStorage';
import {
  useManualSelection,
  usePipelinePicksSeeded,
} from './useManualSelection';

const INSTANCE = 'instance-selection';
const KEY = `@op/manual-selection:${INSTANCE}:final`;

beforeEach(installMemoryStorage);

describe('useManualSelection', () => {
  it('starts empty and keeps the selection across a remount', () => {
    const first = renderHook(() => useManualSelection(INSTANCE, 'final'));
    expect(first.result.current[0]).toEqual([]);

    act(() => first.result.current[1](['solar', 'bike']));
    first.unmount();

    const second = renderHook(() => useManualSelection(INSTANCE, 'final'));
    expect(second.result.current[0]).toEqual(['solar', 'bike']);
  });

  it('starts a new visit to the phase from a clean draft', () => {
    const reverted = renderHook(() =>
      useManualSelection(INSTANCE, 'final', 'transition-1'),
    );
    act(() => reverted.result.current[1](['solar']));
    const seeded = renderHook(() =>
      usePipelinePicksSeeded(INSTANCE, 'final', 'transition-1'),
    );
    act(() => seeded.result.current[1](true));

    const reentered = renderHook(() =>
      useManualSelection(INSTANCE, 'final', 'transition-2'),
    );
    const reseeded = renderHook(() =>
      usePipelinePicksSeeded(INSTANCE, 'final', 'transition-2'),
    );

    expect(reentered.result.current[0]).toEqual([]);
    expect(reseeded.result.current[0]).toBe(false);
  });

  it('shares a write with another hook on the same key in this tab', () => {
    const table = renderHook(() => useManualSelection(INSTANCE, 'final'));
    const footer = renderHook(() => useManualSelection(INSTANCE, 'final'));

    act(() => table.result.current[1](['solar']));

    expect(footer.result.current[0]).toEqual(['solar']);
  });

  it('follows a write from another tab', () => {
    const { result } = renderHook(() => useManualSelection(INSTANCE, 'final'));

    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify(['bike']));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(result.current[0]).toEqual(['bike']);
  });

  it('drops the selection when another tab clears the whole storage', () => {
    const { result } = renderHook(() => useManualSelection(INSTANCE, 'final'));
    act(() => result.current[1](['solar']));

    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });

    expect(result.current[0]).toEqual([]);
  });

  it('applies a functional update to the stored selection', () => {
    const { result } = renderHook(() => useManualSelection(INSTANCE, 'final'));

    act(() => result.current[1](['solar']));
    act(() => result.current[1]((prev) => [...prev, 'bike']));

    expect(result.current[0]).toEqual(['solar', 'bike']);
    expect(window.localStorage.getItem(KEY)).toBe(
      JSON.stringify(['solar', 'bike']),
    );
  });

  it('removes the key when the selection is emptied', () => {
    const { result } = renderHook(() => useManualSelection(INSTANCE, 'final'));

    act(() => result.current[1](['solar']));
    act(() => result.current[1]([]));

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current[0]).toEqual([]);
  });

  it('renders and keeps the selection in memory when storage access is denied', () => {
    const denied: Storage = {
      length: 0,
      key: () => {
        throw new Error('denied');
      },
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
      clear: () => {
        throw new Error('denied');
      },
    };
    Object.defineProperty(window, 'localStorage', {
      value: denied,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useManualSelection('instance-storage-denied', 'final'),
    );
    expect(result.current[0]).toEqual([]);

    act(() => result.current[1](['solar']));
    expect(result.current[0]).toEqual(['solar']);
  });

  it('reads a corrupt or foreign value as an empty selection', () => {
    window.localStorage.setItem(KEY, '{not json');
    const corrupt = renderHook(() => useManualSelection(INSTANCE, 'final'));
    expect(corrupt.result.current[0]).toEqual([]);

    window.localStorage.setItem(KEY, JSON.stringify(['solar', 7, null]));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    const foreign = renderHook(() => useManualSelection(INSTANCE, 'final'));
    expect(foreign.result.current[0]).toEqual(['solar']);
  });
});
