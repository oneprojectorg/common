import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { tiptapDocToPlainText } from './tiptapDocToPlainText';

describe('tiptapDocToPlainText', () => {
  it('returns an empty string for empty / nullish input', () => {
    expect(tiptapDocToPlainText(null)).toBe('');
    expect(tiptapDocToPlainText(undefined)).toBe('');
    expect(tiptapDocToPlainText({ type: 'doc', content: [] })).toBe('');
  });

  it('joins block text with newlines and concatenates inline runs', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second line.' }],
        },
      ],
    };

    expect(tiptapDocToPlainText(doc)).toBe('Hello world\nSecond line.');
  });

  it('extracts text from nested children of UNKNOWN node types', () => {
    // The whole point of the fallback: even when a node type isn't recognized
    // (the case that throws in the static renderer), its text is still readable.
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'someFutureNode',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'still readable' }],
            },
          ],
        },
      ],
    };

    expect(tiptapDocToPlainText(doc)).toBe('still readable');
  });

  it('splits a container node (details) so summary and body are separate blocks', () => {
    // Without container-aware walking, a details node collapses its summary and
    // body into one run ("Question?Answer."); each should be its own line.
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'details',
          content: [
            {
              type: 'detailsSummary',
              content: [{ type: 'text', text: 'Question?' }],
            },
            {
              type: 'detailsContent',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Answer.' }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(tiptapDocToPlainText(doc)).toBe('Question?\nAnswer.');
  });
});
