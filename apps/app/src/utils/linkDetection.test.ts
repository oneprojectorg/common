import { type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { linkifyText } from './linkDetection';

function getType(el: ReactElement): string {
  return el.type as string;
}

function getProps(el: ReactElement): Record<string, unknown> {
  return el.props as Record<string, unknown>;
}

describe('linkifyText', () => {
  it('preserves newlines as <br> elements', () => {
    const result = linkifyText('line one\nline two\nline three');
    const types = result.map(getType);
    const brCount = types.filter((t) => t === 'br').length;

    expect(brCount).toBe(2);
  });

  it('renders text between newlines in spans', () => {
    const result = linkifyText('hello\nworld');
    expect(getType(result[0]!)).toBe('span');
    expect(getProps(result[0]!).children).toBe('hello');
    expect(getType(result[1]!)).toBe('br');
    expect(getType(result[2]!)).toBe('span');
    expect(getProps(result[2]!).children).toBe('world');
  });

  it('handles text with URLs and newlines', () => {
    const result = linkifyText('check this\nhttps://example.com\ncool right?');
    const types = result.map(getType);

    expect(types).toContain('br');
    expect(types).toContain('a');
    expect(types).toContain('span');
  });

  it('still linkifies URLs', () => {
    const result = linkifyText('visit https://example.com today');
    const link = result.find((el) => getType(el) === 'a');

    expect(link).toBeDefined();
    expect(getProps(link!).href).toBe('https://example.com');
  });

  it('returns empty array for empty string', () => {
    expect(linkifyText('')).toEqual([]);
  });

  it('handles consecutive newlines', () => {
    const result = linkifyText('a\n\nb');
    const brCount = result.filter((el) => getType(el) === 'br').length;

    expect(brCount).toBe(2);
  });
});
