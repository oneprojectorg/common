import { describe, expect, it } from 'vitest';

import {
  MAX_MAPPING_EXPRESSION_DEPTH,
  mappingExpressionSchema,
} from './schema';
import type { MappingExpression } from './types';

describe('mappingExpressionSchema', () => {
  it('rejects an operator that is not add', () => {
    const expression = {
      operator: 'multiply',
      operands: [{ field: 'a' }, { value: 2 }],
    };

    expect(mappingExpressionSchema.safeParse(expression).success).toBe(false);
  });

  it('accepts nesting up to the depth cap and rejects one level more', () => {
    let expression: MappingExpression = { field: 'cost' };
    for (let level = 1; level < MAX_MAPPING_EXPRESSION_DEPTH; level++) {
      expression = { operator: 'add', operands: [expression, { value: 1 }] };
    }
    const deeper = { operator: 'add', operands: [expression, { value: 1 }] };

    expect(mappingExpressionSchema.safeParse(expression).success).toBe(true);
    expect(mappingExpressionSchema.safeParse(deeper).success).toBe(false);
  });
});
