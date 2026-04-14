import { describe, expect, it } from 'vitest';

import { extractTextFromTipTapDoc } from './extractTextFromTipTapDoc';

describe('extractTextFromTipTapDoc', () => {
  it('returns empty string for empty doc', () => {
    expect(extractTextFromTipTapDoc({ content: [] })).toBe('');
  });

  it('returns empty string for doc with no content key', () => {
    expect(extractTextFromTipTapDoc({})).toBe('');
  });

  it('extracts plain text from paragraph nodes', () => {
    const doc = {
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(extractTextFromTipTapDoc(doc)).toBe('Hello world');
  });

  it('returns src URL for iframely atom nodes', () => {
    const doc = {
      content: [
        {
          type: 'iframely',
          attrs: { src: 'https://youtu.be/abc123' },
        },
      ],
    };
    expect(extractTextFromTipTapDoc(doc)).toBe('https://youtu.be/abc123');
  });

  it('treats doc with only iframely node as non-empty', () => {
    const doc = {
      content: [
        {
          type: 'iframely',
          attrs: { src: 'https://vimeo.com/123' },
        },
      ],
    };
    expect(extractTextFromTipTapDoc(doc).length).toBeGreaterThan(0);
  });

  it('handles mixed content: text + iframely', () => {
    const doc = {
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Check this out:' }],
        },
        {
          type: 'iframely',
          attrs: { src: 'https://youtu.be/abc123' },
        },
      ],
    };
    expect(extractTextFromTipTapDoc(doc)).toBe(
      'Check this out:\nhttps://youtu.be/abc123',
    );
  });

  it('returns empty string for iframely with missing src', () => {
    const doc = {
      content: [{ type: 'iframely', attrs: {} }],
    };
    expect(extractTextFromTipTapDoc(doc)).toBe('');
  });

  it('returns empty string for iframely with no attrs', () => {
    const doc = {
      content: [{ type: 'iframely' }],
    };
    expect(extractTextFromTipTapDoc(doc)).toBe('');
  });

  it('returns empty string for iframely with non-string src', () => {
    const doc = {
      content: [{ type: 'iframely', attrs: { src: 123 } }],
    };
    expect(extractTextFromTipTapDoc(doc)).toBe('');
  });

  it('skips non-object entries in content array', () => {
    const doc = {
      content: [
        'not a node',
        null,
        { type: 'paragraph', content: [{ type: 'text', text: 'valid' }] },
      ],
    };
    expect(extractTextFromTipTapDoc(doc)).toBe('valid');
  });
});
