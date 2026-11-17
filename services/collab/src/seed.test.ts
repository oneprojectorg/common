import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { createTipTapClient } from './client';
import { type SeedFragments, encodeSeedUpdate } from './seed';

/** Decodes an update into fragment name → paragraphs (`null` = no text node). */
function decode(update: Uint8Array, names: string[]) {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, update);

  return Object.fromEntries(
    names.map((name) => [
      name,
      ydoc
        .getXmlFragment(name)
        .toArray()
        .map((node) => {
          if (!(node instanceof Y.XmlElement)) {
            throw new Error(`Expected an XmlElement in ${name}`);
          }
          const children = node.toArray();
          const [text] = children;
          return {
            nodeName: node.nodeName,
            childCount: children.length,
            text: text instanceof Y.XmlText ? text.toString() : null,
          };
        }),
    ]),
  );
}

describe('encodeSeedUpdate', () => {
  it('writes a line as one paragraph and collapses its whitespace', () => {
    const update = encodeSeedUpdate({
      title: { kind: 'line', text: '  Solar\n roofs   for   all  ' },
    });

    expect(decode(update, ['title'])).toEqual({
      title: [
        { nodeName: 'paragraph', childCount: 1, text: 'Solar roofs for all' },
      ],
    });
  });

  it('writes one paragraph per line and keeps blank lines as empty paragraphs', () => {
    const update = encodeSeedUpdate({
      description: { kind: 'paragraphs', text: '\nFirst.\r\n\nSecond.  \n' },
    });

    expect(decode(update, ['description'])).toEqual({
      description: [
        { nodeName: 'paragraph', childCount: 1, text: 'First.' },
        { nodeName: 'paragraph', childCount: 0, text: null },
        { nodeName: 'paragraph', childCount: 1, text: 'Second.' },
      ],
    });
  });

  it('writes each fragment under its own name and skips empty ones', () => {
    const update = encodeSeedUpdate({
      title: { kind: 'line', text: 'Title' },
      description: { kind: 'paragraphs', text: 'Body' },
      summary: { kind: 'paragraphs', text: '   ' },
    });

    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, update);

    expect([...ydoc.share.keys()].sort()).toEqual(['description', 'title']);
    expect(decode(update, ['title', 'description'])).toEqual({
      title: [{ nodeName: 'paragraph', childCount: 1, text: 'Title' }],
      description: [{ nodeName: 'paragraph', childCount: 1, text: 'Body' }],
    });
  });
});

describe('createDocument', () => {
  const fragments: SeedFragments = {
    title: { kind: 'line', text: 'Title' },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stubs fetch and records each request with its body read up front. */
  function stubFetch(status: number) {
    const requests: { request: Request; body: Uint8Array }[] = [];
    vi.stubGlobal('fetch', async (request: Request) => {
      requests.push({
        request,
        body: new Uint8Array(await request.clone().arrayBuffer()),
      });
      return new Response(null, { status });
    });
    return requests;
  }

  const client = createTipTapClient({ appId: 'app', secret: 'secret' });

  it('posts the Yjs update as a binary body', async () => {
    const requests = stubFetch(204);

    await expect(client.createDocument('proposal-1', fragments)).resolves.toBe(
      'created',
    );

    expect(requests).toHaveLength(1);
    const [sent] = requests;
    if (!sent) {
      throw new Error('fetch was not called');
    }
    const { request, body } = sent;
    expect(request.method).toBe('POST');
    expect(request.url).toBe(
      'https://app.collab.tiptap.cloud/api/documents/proposal-1',
    );
    expect(request.headers.get('Content-Type')).toBe(
      'application/octet-stream',
    );
    expect(decode(body, ['title'])).toEqual({
      title: [{ nodeName: 'paragraph', childCount: 1, text: 'Title' }],
    });
  });

  it('returns exists without throwing when the document is already there', async () => {
    stubFetch(409);

    await expect(client.createDocument('proposal-1', fragments)).resolves.toBe(
      'exists',
    );
  });

  it('throws on any other error', async () => {
    stubFetch(500);

    await expect(
      client.createDocument('proposal-1', fragments),
    ).rejects.toThrow();
  });
});
