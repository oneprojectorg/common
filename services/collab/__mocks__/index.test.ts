import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { TipTapFragmentResponse } from '../src/client';
import { createTipTapClient, mockCollab } from './index';

const client = createTipTapClient();

/** Seeds `fragments`, reads them as an update and stores it as a new document. */
async function roundTrip(
  fragments: TipTapFragmentResponse,
): Promise<TipTapFragmentResponse> {
  const sourceName = `source-${randomUUID()}`;
  const copyName = `copy-${randomUUID()}`;
  mockCollab.setDocFragmentResponses(sourceName, fragments);

  const update = await client.getDocumentUpdate(sourceName);
  if (!update) {
    throw new Error('Expected an update');
  }
  await expect(
    client.createDocument(copyName, new Uint8Array(update)),
  ).resolves.toBe('created');

  return client.getDocumentFragments(copyName, Object.keys(fragments));
}

describe('mock TipTap client', () => {
  it('keeps adjacent text runs with different marks in their order', async () => {
    const fragments: TipTapFragmentResponse = {
      summary: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Plant ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'trees' },
              {
                type: 'text',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.org/river' },
                  },
                ],
                text: ' by the river',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', marks: [{ type: 'italic' }], text: 'Second' },
              { type: 'text', text: ' paragraph' },
            ],
          },
        ],
      },
    };

    await expect(roundTrip(fragments)).resolves.toEqual(fragments);
  });

  it('keeps numeric and structured node attributes as they are', async () => {
    const fragments: TipTapFragmentResponse = {
      summary: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Goals' }],
          },
          {
            type: 'image',
            attrs: {
              src: 'https://example.org/map.png',
              size: { width: 640, height: 480 },
              tags: ['map', 'river'],
            },
          },
        ],
      },
    };

    await expect(roundTrip(fragments)).resolves.toEqual(fragments);
  });

  it('leaves out a null node attribute, as y-prosemirror does', async () => {
    await expect(
      roundTrip({
        summary: {
          type: 'doc',
          content: [
            {
              type: 'codeBlock',
              attrs: { language: null, wrap: false },
              content: [{ type: 'text', text: 'x = 1' }],
            },
          ],
        },
      }),
    ).resolves.toEqual({
      summary: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { wrap: false },
            content: [{ type: 'text', text: 'x = 1' }],
          },
        ],
      },
    });
  });
});
