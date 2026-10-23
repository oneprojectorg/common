import { describe, expect, it } from 'vitest';

import { formatSmsAmount } from './formatSmsAmount';

describe('formatSmsAmount', () => {
  it('given a dollar amount, then it is grouped in thousands behind the symbol', () => {
    expect(
      formatSmsAmount({
        amount: 85_000,
        unit: { kind: 'currency', code: 'USD' },
      }),
    ).toBe('$85,000');
    expect(
      formatSmsAmount({
        amount: 1_000_000,
        unit: { kind: 'currency', code: 'USD' },
      }),
    ).toBe('$1,000,000');
  });

  it('given a fractional amount, then the cents survive the grouping', () => {
    expect(
      formatSmsAmount({
        amount: 1234.5,
        unit: { kind: 'currency', code: 'USD' },
      }),
    ).toBe('$1,234.5');
  });

  it('given a custom unit, then the grouped amount comes before the label', () => {
    expect(
      formatSmsAmount({
        amount: 1500,
        unit: { kind: 'custom', label: 'dots' },
      }),
    ).toBe('1,500 dots');
  });
});
