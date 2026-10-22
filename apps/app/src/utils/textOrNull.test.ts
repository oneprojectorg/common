import { describe, expect, it } from 'vitest';

import { textOrNull } from './textOrNull';

describe.concurrent('textOrNull', () => {
  it('returns null for an empty field', () => {
    expect(textOrNull('')).toBeNull();
  });

  it('returns null for a field that holds only spaces', () => {
    expect(textOrNull('   ')).toBeNull();
  });

  it('returns null when the field is absent', () => {
    expect(textOrNull(undefined)).toBeNull();
    expect(textOrNull(null)).toBeNull();
  });

  it('returns the trimmed text when the field holds text', () => {
    expect(textOrNull('  Budget delegate facilitator ')).toBe(
      'Budget delegate facilitator',
    );
  });
});
