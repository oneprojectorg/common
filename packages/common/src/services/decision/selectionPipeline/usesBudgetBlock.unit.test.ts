import { describe, expect, it } from 'vitest';

import type { Block } from './types';
import { usesBudgetBlock } from './usesBudgetBlock';

const budget: Block = { id: 'fit', type: 'budget', budget: 1 };
const limit: Block = { id: 'top', type: 'limit', count: 1 };
const always = { value: true };

describe('usesBudgetBlock', () => {
  it('is false for an empty pipeline', () => {
    expect(usesBudgetBlock([])).toBe(false);
  });

  it('finds a top-level budget block', () => {
    expect(usesBudgetBlock([limit, budget])).toBe(true);
  });

  it('finds a budget block inside a branch', () => {
    expect(
      usesBudgetBlock([
        {
          id: 'route',
          type: 'branch',
          branches: [{ condition: always, blocks: [limit, budget] }],
        },
      ]),
    ).toBe(true);
  });

  it('finds a budget block inside the default branch', () => {
    expect(
      usesBudgetBlock([
        {
          id: 'route',
          type: 'branch',
          branches: [{ condition: always, blocks: [limit] }],
          default: { blocks: [budget] },
        },
      ]),
    ).toBe(true);
  });

  it('is false when no branch holds a budget block', () => {
    expect(
      usesBudgetBlock([
        {
          id: 'route',
          type: 'branch',
          branches: [{ condition: always, blocks: [limit] }],
          default: { blocks: [limit] },
        },
      ]),
    ).toBe(false);
  });
});
