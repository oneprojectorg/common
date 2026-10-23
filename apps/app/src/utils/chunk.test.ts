import { describe, expect, it } from 'vitest';

import { chunk } from './chunk';

describe.concurrent('chunk', () => {
  it('returns no groups for no items', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('fills every group but the last', () => {
    expect(chunk(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e'],
    ]);
  });

  it('keeps earlier groups unchanged as the list grows', () => {
    const loaded = ['a', 'b', 'c'];
    const before = chunk(loaded, 2);
    const after = chunk([...loaded, 'd', 'e'], 2);

    expect(after.slice(0, before.length - 1)).toEqual(
      before.slice(0, before.length - 1),
    );
    expect(after).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('rejects a size that is not a positive integer', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });
});
