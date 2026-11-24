import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { createTipTapClient } from './client';
import { encodeFragmentCopies, encodeFragments } from './fragmentCopy';
import { readFragmentText } from './fragmentText';

function buildUpdate(
  fragments: Record<string, (fragment: Y.XmlFragment) => void>,
): Uint8Array {
  const ydoc = new Y.Doc();
  for (const [name, build] of Object.entries(fragments)) {
    build(ydoc.getXmlFragment(name));
  }
  return Y.encodeStateAsUpdate(ydoc);
}

function paragraph(text: string): Y.XmlElement {
  const element = new Y.XmlElement('paragraph');
  element.insert(0, [new Y.XmlText(text)]);
  return element;
}

function readFragment(update: Uint8Array | null, name: string): string {
  if (!update) {
    throw new Error('Expected an update');
  }
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, update);
  return ydoc.getXmlFragment(name).toString();
}

function readFragmentNames(update: Uint8Array | null): string[] {
  if (!update) {
    throw new Error('Expected an update');
  }
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, update);
  return [...ydoc.share.keys()].sort();
}

describe('encodeFragmentCopies', () => {
  it('keeps text marks, a link and a list when it copies a fragment', () => {
    const sourceUpdate = buildUpdate({
      summary: (fragment) => {
        const intro = new Y.XmlElement('paragraph');
        const text = new Y.XmlText();
        text.insert(0, 'Plant ');
        text.insert(6, 'trees', { bold: {} });
        text.insert(11, ' here', {
          link: { href: 'https://example.org/trees' },
        });
        intro.insert(0, [text]);

        const list = new Y.XmlElement('bulletList');
        const item = new Y.XmlElement('listItem');
        item.insert(0, [paragraph('Oaks')]);
        list.insert(0, [item]);
        list.setAttribute('class', 'tight');

        fragment.insert(0, [intro, list]);
      },
    });
    const source = new Y.Doc();
    Y.applyUpdate(source, sourceUpdate);

    const update = encodeFragmentCopies([
      { sourceUpdate, from: 'summary', to: 'summary' },
    ]);

    expect(readFragment(update, 'summary')).toBe(
      source.getXmlFragment('summary').toString(),
    );
    const copied = new Y.Doc();
    if (!update) {
      throw new Error('Expected an update');
    }
    Y.applyUpdate(copied, update);
    const [intro, list] = copied.getXmlFragment('summary').toArray();
    if (!(intro instanceof Y.XmlElement) || !(list instanceof Y.XmlElement)) {
      throw new Error('Expected two elements');
    }
    const [text] = intro.toArray();
    if (!(text instanceof Y.XmlText)) {
      throw new Error('Expected text');
    }
    expect(text.toDelta()).toEqual([
      { insert: 'Plant ' },
      { insert: 'trees', attributes: { bold: {} } },
      {
        insert: ' here',
        attributes: { link: { href: 'https://example.org/trees' } },
      },
    ]);
    expect(list.nodeName).toBe('bulletList');
    expect(list.getAttribute('class')).toBe('tight');
    expect(list.toString()).toBe(
      // `toString` lowercases node names.
      '<bulletlist class="tight"><listitem><paragraph>Oaks</paragraph></listitem></bulletlist>',
    );
  });

  it('copies a fragment under a different target name', () => {
    const sourceUpdate = buildUpdate({
      summary: (fragment) => fragment.insert(0, [paragraph('Body')]),
    });

    const update = encodeFragmentCopies([
      { sourceUpdate, from: 'summary', to: 'description' },
    ]);

    expect(readFragmentNames(update)).toEqual(['description']);
    expect(readFragment(update, 'description')).toBe(
      '<paragraph>Body</paragraph>',
    );
  });

  it('feeds two targets from two sources', () => {
    const first = buildUpdate({
      title: (fragment) => fragment.insert(0, [paragraph('First title')]),
    });
    const second = buildUpdate({
      summary: (fragment) => fragment.insert(0, [paragraph('Second body')]),
    });

    const update = encodeFragmentCopies([
      { sourceUpdate: first, from: 'title', to: 'title' },
      { sourceUpdate: second, from: 'summary', to: 'description' },
    ]);

    expect(readFragmentNames(update)).toEqual(['description', 'title']);
    expect(readFragment(update, 'title')).toBe(
      '<paragraph>First title</paragraph>',
    );
    expect(readFragment(update, 'description')).toBe(
      '<paragraph>Second body</paragraph>',
    );
  });

  it('fills a target from the first source whose fragment is not empty', () => {
    const empty = buildUpdate({ summary: () => {} });
    const first = buildUpdate({
      summary: (fragment) => fragment.insert(0, [paragraph('First')]),
    });
    const second = buildUpdate({
      summary: (fragment) => fragment.insert(0, [paragraph('Second')]),
    });

    const update = encodeFragmentCopies([
      { sourceUpdate: empty, from: 'summary', to: 'description' },
      { sourceUpdate: first, from: 'summary', to: 'description' },
      { sourceUpdate: second, from: 'summary', to: 'description' },
    ]);

    expect(readFragment(update, 'description')).toBe(
      '<paragraph>First</paragraph>',
    );
  });

  it('adds nothing for an empty or missing source fragment', () => {
    const sourceUpdate = buildUpdate({
      title: (fragment) => fragment.insert(0, [paragraph('Title')]),
      empty: () => {},
    });

    expect(
      encodeFragmentCopies([
        { sourceUpdate, from: 'empty', to: 'summary' },
        { sourceUpdate, from: 'missing', to: 'budget' },
      ]),
    ).toBeNull();
    expect(
      readFragmentNames(
        encodeFragmentCopies([
          { sourceUpdate, from: 'title', to: 'title' },
          { sourceUpdate, from: 'missing', to: 'budget' },
        ]),
      ),
    ).toEqual(['title']);
  });
});

describe('encodeFragments', () => {
  function readText(update: Uint8Array | null, name: string): string {
    if (!update) {
      throw new Error('Expected an update');
    }
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, update);
    return readFragmentText(ydoc.getXmlFragment(name));
  }

  it('writes a text fragment that reads back as the same text', () => {
    const text = JSON.stringify({ amount: 5000, currency: 'USD' });

    const update = encodeFragments({
      copies: [],
      texts: [{ to: 'budget', text }],
    });

    expect(readText(update, 'budget')).toBe(text);
    expect(readFragment(update, 'budget')).toBe(
      `<paragraph>${text}</paragraph>`,
    );
  });

  it('keeps the copy when a text targets the same fragment', () => {
    const sourceUpdate = buildUpdate({
      budget: (fragment) =>
        fragment.insert(0, [paragraph('{"amount":10,"currency":"EUR"}')]),
    });

    const update = encodeFragments({
      copies: [{ sourceUpdate, from: 'budget', to: 'budget' }],
      texts: [{ to: 'budget', text: '{"amount":99,"currency":"USD"}' }],
    });

    expect(readText(update, 'budget')).toBe('{"amount":10,"currency":"EUR"}');
  });

  it('holds copies and texts for different targets in one update', () => {
    const sourceUpdate = buildUpdate({
      title: (fragment) => fragment.insert(0, [paragraph('Title')]),
    });

    const update = encodeFragments({
      copies: [{ sourceUpdate, from: 'title', to: 'title' }],
      texts: [{ to: 'location', text: '{"lat":1,"lng":2}' }],
    });

    expect(readFragmentNames(update)).toEqual(['location', 'title']);
    expect(readText(update, 'title')).toBe('Title');
    expect(readText(update, 'location')).toBe('{"lat":1,"lng":2}');
  });

  it('gives null when there is only an empty text', () => {
    expect(
      encodeFragments({ copies: [], texts: [{ to: 'budget', text: '' }] }),
    ).toBeNull();
  });
});

describe('TipTap client document updates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stubs fetch and records each request with its body read up front. */
  function stubFetch(response: () => Response) {
    const requests: { request: Request; body: Uint8Array }[] = [];
    vi.stubGlobal('fetch', async (request: Request) => {
      requests.push({
        request,
        body: new Uint8Array(await request.clone().arrayBuffer()),
      });
      return response();
    });
    return requests;
  }

  const client = createTipTapClient({ appId: 'app', secret: 'secret' });
  const update = new Uint8Array(
    buildUpdate({
      title: (fragment) => fragment.insert(0, [paragraph('Title')]),
    }),
  );

  it('reads a document as a binary Yjs update', async () => {
    const requests = stubFetch(() => new Response(update, { status: 200 }));

    await expect(client.getDocumentUpdate('proposal-1')).resolves.toEqual(
      update,
    );
    const [sent] = requests;
    if (!sent) {
      throw new Error('fetch was not called');
    }
    expect(sent.request.method).toBe('GET');
    expect(sent.request.url).toBe(
      'https://app.collab.tiptap.cloud/api/documents/proposal-1?format=yjs',
    );
  });

  it('asks for a saved version when one is given', async () => {
    const requests = stubFetch(() => new Response(update, { status: 200 }));

    await client.getDocumentUpdate('proposal-1', { version: 3 });

    expect(requests[0]?.request.url).toBe(
      'https://app.collab.tiptap.cloud/api/documents/proposal-1?format=yjs&version=3',
    );
  });

  it('gives null for a document that does not exist', async () => {
    stubFetch(() => new Response(null, { status: 404 }));

    await expect(client.getDocumentUpdate('proposal-1')).resolves.toBeNull();
  });

  it('posts the update as a binary body when it creates a document', async () => {
    const requests = stubFetch(() => new Response(null, { status: 204 }));

    await expect(client.createDocument('proposal-1', update)).resolves.toBe(
      'created',
    );
    const [sent] = requests;
    if (!sent) {
      throw new Error('fetch was not called');
    }
    expect(sent.request.method).toBe('POST');
    expect(sent.request.url).toBe(
      'https://app.collab.tiptap.cloud/api/documents/proposal-1',
    );
    expect(sent.request.headers.get('Content-Type')).toBe(
      'application/octet-stream',
    );
    expect(sent.body).toEqual(update);
  });

  it('returns exists without throwing when the document is already there', async () => {
    stubFetch(() => new Response(null, { status: 409 }));

    await expect(client.createDocument('proposal-1', update)).resolves.toBe(
      'exists',
    );
  });

  it('throws on any other create error', async () => {
    stubFetch(() => new Response(null, { status: 500 }));

    await expect(client.createDocument('proposal-1', update)).rejects.toThrow();
  });
});
