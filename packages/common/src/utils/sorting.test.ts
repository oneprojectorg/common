import { describe, expect, it } from 'vitest';

import { computeSortOrderUpdates } from './sorting';

type Row = { id: string; key: string; sortOrder: number };
const rows = (...keys: string[]): Row[] =>
  keys.map((key, i) => ({ id: `id-${key}`, key, sortOrder: i }));

const compute = (
  list: readonly Row[],
  movedKey: string,
  upperNeighborKey: string | null,
) =>
  computeSortOrderUpdates({
    rows: list,
    getId: (r) => r.id,
    getKey: (r) => r.key,
    getSortOrder: (r) => r.sortOrder,
    movedKey,
    upperNeighborKey,
  });

describe('computeSortOrderUpdates', () => {
  it('moves an item to the top when upperNeighborKey is null', () => {
    // a:0 b:1 c:2 d:3  →  c:0 a:1 b:2 d:3
    expect(compute(rows('a', 'b', 'c', 'd'), 'c', null)).toEqual([
      { id: 'id-c', sortOrder: 0 },
      { id: 'id-a', sortOrder: 1 },
      { id: 'id-b', sortOrder: 2 },
    ]);
  });

  it('moves an item down to sit after the named upper neighbor', () => {
    // a:0 b:1 c:2 d:3  →  b:0 c:1 a:2 d:3
    expect(compute(rows('a', 'b', 'c', 'd'), 'a', 'c')).toEqual([
      { id: 'id-b', sortOrder: 0 },
      { id: 'id-c', sortOrder: 1 },
      { id: 'id-a', sortOrder: 2 },
    ]);
  });

  it('moves an item up to sit after the named upper neighbor', () => {
    // a:0 b:1 c:2 d:3  →  a:0 d:1 b:2 c:3
    expect(compute(rows('a', 'b', 'c', 'd'), 'd', 'a')).toEqual([
      { id: 'id-d', sortOrder: 1 },
      { id: 'id-b', sortOrder: 2 },
      { id: 'id-c', sortOrder: 3 },
    ]);
  });

  it('only emits updates for rows whose position actually changed', () => {
    // a:0 b:1 c:2 d:3  →  a:0 b:1 d:2 c:3  (swap c and d; a and b stay put)
    expect(compute(rows('a', 'b', 'c', 'd'), 'c', 'd')).toEqual([
      { id: 'id-d', sortOrder: 2 },
      { id: 'id-c', sortOrder: 3 },
    ]);
  });

  it('returns empty when the move is a no-op (already in position)', () => {
    expect(compute(rows('a', 'b', 'c'), 'b', 'a')).toEqual([]);
  });

  it('returns empty when moving to top and already at top', () => {
    expect(compute(rows('a', 'b', 'c'), 'a', null)).toEqual([]);
  });

  it('returns empty when movedKey equals upperNeighborKey', () => {
    expect(compute(rows('a', 'b', 'c'), 'b', 'b')).toEqual([]);
  });

  it('returns empty when movedKey is missing', () => {
    expect(compute(rows('a', 'b', 'c'), 'missing', 'a')).toEqual([]);
  });

  it('returns empty when upperNeighborKey is missing', () => {
    expect(compute(rows('a', 'b', 'c'), 'a', 'missing')).toEqual([]);
  });

  it('handles a single-item list moved to top (no-op)', () => {
    expect(compute(rows('only'), 'only', null)).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(compute([], 'any', null)).toEqual([]);
  });

  it('swaps two adjacent items by moving the upper one below', () => {
    // a:0 b:1  →  b:0 a:1
    expect(compute(rows('a', 'b'), 'a', 'b')).toEqual([
      { id: 'id-b', sortOrder: 0 },
      { id: 'id-a', sortOrder: 1 },
    ]);
  });

  it('moves the last item to the top', () => {
    // a:0 b:1 c:2 d:3  →  d:0 a:1 b:2 c:3
    expect(compute(rows('a', 'b', 'c', 'd'), 'd', null)).toEqual([
      { id: 'id-d', sortOrder: 0 },
      { id: 'id-a', sortOrder: 1 },
      { id: 'id-b', sortOrder: 2 },
      { id: 'id-c', sortOrder: 3 },
    ]);
  });

  it('moves the first item to the bottom', () => {
    // a:0 b:1 c:2 d:3  →  b:0 c:1 d:2 a:3
    expect(compute(rows('a', 'b', 'c', 'd'), 'a', 'd')).toEqual([
      { id: 'id-b', sortOrder: 0 },
      { id: 'id-c', sortOrder: 1 },
      { id: 'id-d', sortOrder: 2 },
      { id: 'id-a', sortOrder: 3 },
    ]);
  });

  it('uses getId / getKey independently so the API key need not equal the row PK', () => {
    // Row has separate `id` (PK) and `key` (API identifier).
    const list = [
      { id: 'pk-1', key: 'alpha', sortOrder: 0 },
      { id: 'pk-2', key: 'beta', sortOrder: 1 },
      { id: 'pk-3', key: 'gamma', sortOrder: 2 },
    ];
    expect(
      computeSortOrderUpdates({
        rows: list,
        getId: (r) => r.id,
        getKey: (r) => r.key,
        getSortOrder: (r) => r.sortOrder,
        movedKey: 'gamma',
        upperNeighborKey: null,
      }),
    ).toEqual([
      { id: 'pk-3', sortOrder: 0 },
      { id: 'pk-1', sortOrder: 1 },
      { id: 'pk-2', sortOrder: 2 },
    ]);
  });
});
