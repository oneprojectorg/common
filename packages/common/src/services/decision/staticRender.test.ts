import type { JSONContent } from '@tiptap/core';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { describe, expect, it } from 'vitest';

import { serverExtensions } from './tiptapExtensions';

/**
 * The static renderer (`@tiptap/static-renderer`) is the foundation for SSR
 * rich-text rendering. It must recognize every node/mark in `serverExtensions`
 * — an unregistered NODE type THROWS during the JSON→doc parse (see the last
 * test); `RichTextRenderer` guards that with a plain-text fallback so it can't
 * crash the whole surrounding tab. These assertions guard the shared extension
 * set against drift. Output is asserted structurally rather
 * than byte-compared to `generateHTML`: both are "ours", but they use different
 * serializers, so exact-string parity would be brittle without adding value.
 *
 * The React entry (`renderToReactElement`) used by the app shares this same
 * node/mark coverage; html-string is used here to keep the test free of a
 * react-dom dependency in this package.
 */
describe('static renderer × serverExtensions', () => {
  it('renders standard nodes and marks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'i', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'u', marks: [{ type: 'underline' }] },
            {
              type: 'text',
              text: 'link',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
              ],
            },
          ],
        },
        { type: 'image', attrs: { src: 'https://img.test/a.png' } },
      ],
    };

    const html = renderToHTMLString({
      content: doc,
      extensions: serverExtensions,
    });

    expect(html).toContain('<h2');
    expect(html).toContain('Title');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('<em>i</em>');
    expect(html).toContain('<u>u</u>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('one');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://img.test/a.png"');
  });

  it('renders an h4 as <h4>, not falling back to <h1>', () => {
    // The editor allows heading levels 1-4; serverExtensions must too, or
    // TipTap's renderHTML falls back to levels[0] and an H4 renders as H1.
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 4 },
          content: [{ type: 'text', text: 'Sub-subheading' }],
        },
      ],
    };

    const html = renderToHTMLString({
      content: doc,
      extensions: serverExtensions,
    });

    expect(html).toContain('<h4');
    expect(html).not.toContain('<h1');
  });

  it('renders the iframely node as its placeholder div (carrying the src)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'iframely', attrs: { src: 'https://youtube.com/watch?v=x' } },
      ],
    };

    const html = renderToHTMLString({
      content: doc,
      extensions: serverExtensions,
    });

    // The iframely node must survive the static render (the app's nodeMapping
    // later swaps this placeholder for a <LinkPreview>; here we assert the node
    // is recognized and its src round-trips, rather than being dropped).
    expect(html).toContain('data-iframely');
    expect(html).toContain('data-src="https://youtube.com/watch?v=x"');
  });

  it('throws on an unregistered node type (the failure RichTextRenderer falls back from)', () => {
    // Node.fromJSON throws "Unknown node type" when a stored doc contains a type
    // that isn't in serverExtensions (deploy skew / drift). RichTextRenderer
    // wraps the render and degrades to plain text instead of letting the throw
    // crash the whole surrounding tab.
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'someUnregisteredNode',
          content: [{ type: 'text', text: 'x' }],
        },
      ],
    };

    expect(() =>
      renderToHTMLString({ content: doc, extensions: serverExtensions }),
    ).toThrow();
  });
});
