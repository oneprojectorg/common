import { describe, expect, it } from 'vitest';

import { getViewableOverviewBody } from './getViewableOverviewBody';

const doc = (content: object[]) => ({ type: 'doc', content });

describe('getViewableOverviewBody', () => {
  it('returns null for a missing body', () => {
    expect(getViewableOverviewBody(undefined)).toBeNull();
    expect(getViewableOverviewBody('')).toBeNull();
  });

  it('treats a cleared doc of empty paragraphs as empty', () => {
    expect(getViewableOverviewBody(doc([]))).toBeNull();
    expect(
      getViewableOverviewBody(
        doc([{ type: 'paragraph' }, { type: 'paragraph' }]),
      ),
    ).toBeNull();
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
    expect(getViewableOverviewBody(doc(content))).toBeNull();
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
    expect(getViewableOverviewBody(body)).not.toBeNull();
  });

  it('treats an empty legacy HTML body as empty', () => {
    expect(getViewableOverviewBody('  <p></p> ')).toBeNull();
    expect(getViewableOverviewBody('<p><br></p><p>&nbsp;</p>')).toBeNull();
  });

  it('keeps a doc with text', () => {
    const body = doc([
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
    ]);
    expect(getViewableOverviewBody(body)).toEqual(body);
  });

  it('keeps a doc whose only block is not a paragraph', () => {
    expect(
      getViewableOverviewBody(doc([{ type: 'horizontalRule' }])),
    ).not.toBeNull();
  });

  it('keeps a legacy HTML body with content', () => {
    expect(getViewableOverviewBody('<p>Hello</p>')).toBe('<p>Hello</p>');
  });

  it('sanitizes an unknown node so the viewer does not blank the doc', () => {
    const viewable = getViewableOverviewBody(
      doc([
        {
          type: 'notARealNode',
          content: [{ type: 'text', text: 'Kept' }],
        },
      ]),
    );
    expect(JSON.stringify(viewable)).not.toContain('notARealNode');
    expect(JSON.stringify(viewable)).toContain('Kept');
  });
});
