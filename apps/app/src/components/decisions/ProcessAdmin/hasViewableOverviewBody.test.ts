import { describe, expect, it } from 'vitest';

import { hasViewableOverviewBody } from './hasViewableOverviewBody';

const doc = (content: object[]) => ({ type: 'doc', content });

describe('hasViewableOverviewBody', () => {
  it('is false for a missing body', () => {
    expect(hasViewableOverviewBody(undefined)).toBe(false);
    expect(hasViewableOverviewBody('')).toBe(false);
  });

  it('treats a cleared doc of empty paragraphs as empty', () => {
    expect(hasViewableOverviewBody(doc([]))).toBe(false);
    expect(
      hasViewableOverviewBody(
        doc([{ type: 'paragraph' }, { type: 'paragraph' }]),
      ),
    ).toBe(false);
  });

  it.each([
    ['an empty heading', [{ type: 'heading', attrs: { level: 2 } }]],
    [
      'a whitespace-only paragraph',
      [{ type: 'paragraph', content: [{ type: 'text', text: '  \n ' }] }],
    ],
    [
      'a paragraph of line breaks',
      [{ type: 'paragraph', content: [{ type: 'hardBreak' }] }],
    ],
    [
      'an empty list',
      [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    ],
  ])('treats a doc holding only %s as empty', (_label, content) => {
    expect(hasViewableOverviewBody(doc(content))).toBe(false);
  });

  it('keeps a list with text in it', () => {
    const body = doc([
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
            ],
          },
        ],
      },
    ]);
    expect(hasViewableOverviewBody(body)).toBe(true);
  });

  it('treats an empty legacy HTML body as empty', () => {
    expect(hasViewableOverviewBody('  <p></p> ')).toBe(false);
    expect(hasViewableOverviewBody('<p><br></p><p>&nbsp;</p>')).toBe(false);
  });

  it('keeps a doc with text', () => {
    expect(
      hasViewableOverviewBody(
        doc([
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        ]),
      ),
    ).toBe(true);
  });

  it('keeps a doc whose only block is not a paragraph', () => {
    expect(hasViewableOverviewBody(doc([{ type: 'horizontalRule' }]))).toBe(
      true,
    );
  });

  it('keeps a legacy HTML body with content', () => {
    expect(hasViewableOverviewBody('<p>Hello</p>')).toBe(true);
  });

  it('keeps text inside an unknown node, which the renderer sanitizes', () => {
    expect(
      hasViewableOverviewBody(
        doc([
          {
            type: 'notARealNode',
            content: [{ type: 'text', text: 'Kept' }],
          },
        ]),
      ),
    ).toBe(true);
  });
});
