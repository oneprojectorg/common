import type { JSONContent } from '@tiptap/core';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { describe, expect, it } from 'vitest';

import { sanitizeTiptapDoc } from './sanitizeTiptapDoc';
import { serverExtensions } from './tiptapExtensions';

/**
 * Sanitizing coerces unknown node/mark types to known ones so the static
 * renderer can't throw on them. The strongest assertion is that the sanitized
 * doc renders without throwing while keeping the known content.
 */
describe('sanitizeTiptapDoc', () => {
  const render = (doc: JSONContent) =>
    renderToHTMLString({ content: doc, extensions: serverExtensions });

  it('leaves a fully-known doc renderable and intact', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Title' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] },
      ],
    };

    const html = render(sanitizeTiptapDoc(doc));
    expect(html).toContain('<h2');
    expect(html).toContain('Title');
    expect(html).toContain('Body.');
  });

  it('unwraps an unknown container, keeping its known inner blocks rich', () => {
    // A details node (unknown to serverExtensions in this test) wrapping a known
    // paragraph: the summary degrades to a paragraph, the body paragraph stays.
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'someDetails',
          content: [
            {
              type: 'someSummary',
              content: [{ type: 'text', text: 'Question?' }],
            },
            {
              type: 'someContent',
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

    const sanitized = sanitizeTiptapDoc(doc);
    // Two separate paragraphs survive (summary + body), not one merged run.
    expect(sanitized.content).toHaveLength(2);
    // And it renders without throwing.
    const html = render(sanitized);
    expect(html).toContain('Question?');
    expect(html).toContain('Answer.');
  });

  it('strips an unknown mark off a text node so it renders', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'styled',
              marks: [{ type: 'someFutureMark' }, { type: 'bold' }],
            },
          ],
        },
      ],
    };

    const html = render(sanitizeTiptapDoc(doc));
    expect(html).toContain('styled');
    expect(html).toContain('<strong>');
  });
});
