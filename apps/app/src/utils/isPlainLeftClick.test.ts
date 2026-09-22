import { describe, expect, it } from 'vitest';

import { type ClickIntent, isPlainLeftClick } from './isPlainLeftClick';

const click = (overrides: Partial<ClickIntent> = {}): ClickIntent => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  ...overrides,
});

describe('isPlainLeftClick', () => {
  it('accepts an unmodified primary click', () => {
    expect(isPlainLeftClick(click())).toBe(true);
  });

  // Each of these asks the browser for a new tab, window or download. An
  // in-page panel that swallowed them would leave the reader with nothing.
  it('declines every modified click', () => {
    expect(isPlainLeftClick(click({ metaKey: true }))).toBe(false);
    expect(isPlainLeftClick(click({ ctrlKey: true }))).toBe(false);
    expect(isPlainLeftClick(click({ shiftKey: true }))).toBe(false);
    expect(isPlainLeftClick(click({ altKey: true }))).toBe(false);
  });

  it('declines a middle or secondary click', () => {
    expect(isPlainLeftClick(click({ button: 1 }))).toBe(false);
    expect(isPlainLeftClick(click({ button: 2 }))).toBe(false);
  });

  it('declines a click another handler already took', () => {
    expect(isPlainLeftClick(click({ defaultPrevented: true }))).toBe(false);
  });
});
