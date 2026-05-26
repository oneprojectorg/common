import { describe, expect, it } from 'vitest';

import { reorderByUpperNeighbor } from './reorder';

type Row = { id: string };
const rows = (...ids: string[]): readonly Row[] => ids.map((id) => ({ id }));
const ids = (list: readonly Row[]): string[] => list.map((r) => r.id);
const getKey = (r: Row) => r.id;

describe('reorderByUpperNeighbor', () => {
  it('moves an item to the top when upperNeighborKey is null', () => {
    const list = rows('a', 'b', 'c', 'd');
    const result = reorderByUpperNeighbor(list, getKey, 'c', null);
    expect(ids(result)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('moves an item down to sit after the named upper neighbor', () => {
    const list = rows('a', 'b', 'c', 'd');
    const result = reorderByUpperNeighbor(list, getKey, 'a', 'c');
    expect(ids(result)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up to sit after the named upper neighbor', () => {
    const list = rows('a', 'b', 'c', 'd');
    const result = reorderByUpperNeighbor(list, getKey, 'd', 'a');
    expect(ids(result)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same list reference when the move is a no-op (already there)', () => {
    const list = rows('a', 'b', 'c');
    expect(reorderByUpperNeighbor(list, getKey, 'b', 'a')).toBe(list);
  });

  it('returns the same list reference when moving to top and already at top', () => {
    const list = rows('a', 'b', 'c');
    expect(reorderByUpperNeighbor(list, getKey, 'a', null)).toBe(list);
  });

  it('returns the same list reference when movedKey equals upperNeighborKey', () => {
    const list = rows('a', 'b', 'c');
    expect(reorderByUpperNeighbor(list, getKey, 'b', 'b')).toBe(list);
  });

  it('returns the same list reference when movedKey is missing', () => {
    const list = rows('a', 'b', 'c');
    expect(reorderByUpperNeighbor(list, getKey, 'missing', 'a')).toBe(list);
  });

  it('returns the same list reference when upperNeighborKey is missing', () => {
    const list = rows('a', 'b', 'c');
    expect(reorderByUpperNeighbor(list, getKey, 'a', 'missing')).toBe(list);
  });

  it('handles a single-item list moved to top (no-op)', () => {
    const list = rows('only');
    expect(reorderByUpperNeighbor(list, getKey, 'only', null)).toBe(list);
  });

  it('handles an empty list', () => {
    const list: readonly Row[] = [];
    expect(reorderByUpperNeighbor(list, getKey, 'any', null)).toBe(list);
  });

  it('swaps two adjacent items by moving the upper one below', () => {
    const list = rows('a', 'b');
    const result = reorderByUpperNeighbor(list, getKey, 'a', 'b');
    expect(ids(result)).toEqual(['b', 'a']);
  });

  it('moves the last item to the top', () => {
    const list = rows('a', 'b', 'c', 'd');
    const result = reorderByUpperNeighbor(list, getKey, 'd', null);
    expect(ids(result)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('moves the first item to the bottom', () => {
    const list = rows('a', 'b', 'c', 'd');
    const result = reorderByUpperNeighbor(list, getKey, 'a', 'd');
    expect(ids(result)).toEqual(['b', 'c', 'd', 'a']);
  });
});
