import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { getFragmentTextFromTipTapDoc } from './getFragmentTextFromTipTapDoc';

describe('getFragmentTextFromTipTapDoc', () => {
  it('returns empty string for nullish / contentless inputs', () => {
    expect(getFragmentTextFromTipTapDoc(null)).toBe('');
    expect(getFragmentTextFromTipTapDoc(undefined)).toBe('');
    expect(getFragmentTextFromTipTapDoc({ type: 'doc' })).toBe('');
    expect(getFragmentTextFromTipTapDoc({ type: 'doc', content: [] })).toBe('');
  });

  it('extracts a single paragraph value verbatim', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'I live here' }],
        },
      ],
    };

    expect(getFragmentTextFromTipTapDoc(doc)).toBe('I live here');
  });

  it('preserves trailing whitespace in a dropdown const — ONE-289', () => {
    // The columbus template has `oneOf.const = "Yes, display my first name "`
    // (note the trailing space). The validator must hand AJV the same exact
    // string the user picked, so `oneOf` matches.
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Yes, display my first name ' }],
        },
      ],
    };

    expect(getFragmentTextFromTipTapDoc(doc)).toBe(
      'Yes, display my first name ',
    );
  });

  it('preserves unicode (em-dash, curly apostrophe) in dropdown consts', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Yes — I’d like to help develop ideas into proposals',
            },
          ],
        },
      ],
    };

    expect(getFragmentTextFromTipTapDoc(doc)).toBe(
      'Yes — I’d like to help develop ideas into proposals',
    );
  });

  it('joins multiple top-level blocks with a single newline', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'first line' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'second line' }],
        },
      ],
    };

    expect(getFragmentTextFromTipTapDoc(doc)).toBe('first line\nsecond line');
  });

  it('treats an empty paragraph as an empty block', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };

    expect(getFragmentTextFromTipTapDoc(doc)).toBe('');
  });

  it('concatenates multiple text nodes within a block without separators', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello, ' },
            { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
            { type: 'text', text: '!' },
          ],
        },
      ],
    };

    expect(getFragmentTextFromTipTapDoc(doc)).toBe('Hello, world!');
  });

  it('round-trips a JSON-stringified money value so JSON.parse still works', () => {
    const value = JSON.stringify({ amount: 100, currency: 'USD' });
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: value }] },
      ],
    };

    expect(getFragmentTextFromTipTapDoc(doc)).toBe(value);
    expect(JSON.parse(getFragmentTextFromTipTapDoc(doc))).toEqual({
      amount: 100,
      currency: 'USD',
    });
  });
});
