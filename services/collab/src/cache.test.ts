import { describe, expect, it, vi } from 'vitest';

import {
  getCachedDocumentFragments,
  invalidateCachedDocumentFragments,
} from './cache';
import type { TipTapClient, TipTapFragmentResponse } from './client';

function makeFragments(text: string): TipTapFragmentResponse {
  return {
    body: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  };
}

type JsonFragmentImpl = (
  docName: string,
  fragments: string[],
  options?: { version?: number },
) => Promise<TipTapFragmentResponse>;

function makeClient(impl: JsonFragmentImpl): {
  client: TipTapClient;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(impl);
  // The wrapper only ever uses the `format='json'` branch, so the spy speaks
  // that overload directly. Cast through `unknown` to satisfy the generic
  // signature without recreating it.
  const client = { getDocumentFragments: spy } as unknown as TipTapClient;
  return { client, spy };
}

describe('getCachedDocumentFragments', () => {
  it('bypasses the cache when versionId is undefined (DRAFT path)', async () => {
    const { client, spy } = makeClient(async () => makeFragments('draft'));

    const first = await getCachedDocumentFragments({
      client,
      docId: `draft-doc-${crypto.randomUUID()}`,
      versionId: undefined,
      fragmentNames: ['body'],
    });
    const second = await getCachedDocumentFragments({
      client,
      docId: `draft-doc-${crypto.randomUUID()}`,
      versionId: undefined,
      fragmentNames: ['body'],
    });

    expect(first).toEqual(makeFragments('draft'));
    expect(second).toEqual(makeFragments('draft'));
    // Both reads hit TipTap — drafts are not cacheable.
    expect(spy).toHaveBeenCalledTimes(2);
    // The bypass uses the no-options call so existing test mocks don't break.
    expect(spy).toHaveBeenLastCalledWith(expect.any(String), ['body']);
  });

  it('caches by (docId, versionId, fragmentsHash) across repeat reads', async () => {
    const { client, spy } = makeClient(async () => makeFragments('published'));
    const docId = `pub-doc-${crypto.randomUUID()}`;

    const first = await getCachedDocumentFragments({
      client,
      docId,
      versionId: 3,
      fragmentNames: ['body'],
    });
    const second = await getCachedDocumentFragments({
      client,
      docId,
      versionId: 3,
      fragmentNames: ['body'],
    });

    expect(first).toEqual(makeFragments('published'));
    expect(second).toEqual(makeFragments('published'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(docId, ['body'], { version: 3 });
  });

  it('fetches independently for different versionIds of the same doc', async () => {
    const responses: Record<number, TipTapFragmentResponse> = {
      1: makeFragments('v1'),
      2: makeFragments('v2'),
    };
    const { client, spy } = makeClient(
      async (_docId, _fragments, options) =>
        responses[options?.version ?? -1] ?? makeFragments('?'),
    );
    const docId = `versioned-doc-${crypto.randomUUID()}`;

    const v1 = await getCachedDocumentFragments({
      client,
      docId,
      versionId: 1,
      fragmentNames: ['body'],
    });
    const v2 = await getCachedDocumentFragments({
      client,
      docId,
      versionId: 2,
      fragmentNames: ['body'],
    });

    expect(v1).toEqual(makeFragments('v1'));
    expect(v2).toEqual(makeFragments('v2'));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('treats different fragment lists as different cache entries', async () => {
    const { client, spy } = makeClient(async (_doc, fragments) => {
      const entries = fragments.map((name) => [name, makeFragments(name).body]);
      return Object.fromEntries(entries) as TipTapFragmentResponse;
    });
    const docId = `frag-doc-${crypto.randomUUID()}`;

    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 7,
      fragmentNames: ['body'],
    });
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 7,
      fragmentNames: ['body', 'summary'],
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('treats fragment lists as set-equivalent regardless of order', async () => {
    const { client, spy } = makeClient(async (_doc, fragments) => {
      const entries = fragments.map((name) => [name, makeFragments(name).body]);
      return Object.fromEntries(entries) as TipTapFragmentResponse;
    });
    const docId = `order-doc-${crypto.randomUUID()}`;

    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 9,
      fragmentNames: ['summary', 'body'],
    });
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 9,
      fragmentNames: ['body', 'summary'],
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('drops the cached entry on invalidate so the next read hits TipTap again', async () => {
    const { client, spy } = makeClient(async () => makeFragments('cached'));
    const docId = `invalidate-doc-${crypto.randomUUID()}`;

    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 4,
      fragmentNames: ['body'],
    });
    // Second read should be served from cache — sanity check before invalidate.
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 4,
      fragmentNames: ['body'],
    });
    expect(spy).toHaveBeenCalledTimes(1);

    await invalidateCachedDocumentFragments({
      docId,
      versionId: 4,
      fragmentNames: ['body'],
    });

    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 4,
      fragmentNames: ['body'],
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('matches the cached entry regardless of fragment-name order', async () => {
    const { client, spy } = makeClient(async () => makeFragments('cached'));
    const docId = `invalidate-order-doc-${crypto.randomUUID()}`;

    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 6,
      fragmentNames: ['summary', 'body'],
    });

    // The caller spells fragments in a different order — invalidate must still
    // hit the same key because the hash is order-independent.
    await invalidateCachedDocumentFragments({
      docId,
      versionId: 6,
      fragmentNames: ['body', 'summary'],
    });

    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 6,
      fragmentNames: ['summary', 'body'],
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not evict other versions, fragment sets, or docs', async () => {
    const { client, spy } = makeClient(async (docId, fragments, options) =>
      makeFragments(
        `${docId}@${options?.version ?? 'live'}#${fragments.join(',')}`,
      ),
    );
    const docId = `invalidate-scope-doc-${crypto.randomUUID()}`;
    const otherDocId = `invalidate-other-doc-${crypto.randomUUID()}`;

    // Seed three distinct entries.
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 1,
      fragmentNames: ['body'],
    });
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 2,
      fragmentNames: ['body'],
    });
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 1,
      fragmentNames: ['body', 'summary'],
    });
    await getCachedDocumentFragments({
      client,
      docId: otherDocId,
      versionId: 1,
      fragmentNames: ['body'],
    });
    expect(spy).toHaveBeenCalledTimes(4);

    // Drop only (docId, 1, [body]).
    await invalidateCachedDocumentFragments({
      docId,
      versionId: 1,
      fragmentNames: ['body'],
    });

    // The invalidated key now refetches; everyone else is still warm.
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 1,
      fragmentNames: ['body'],
    });
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 2,
      fragmentNames: ['body'],
    });
    await getCachedDocumentFragments({
      client,
      docId,
      versionId: 1,
      fragmentNames: ['body', 'summary'],
    });
    await getCachedDocumentFragments({
      client,
      docId: otherDocId,
      versionId: 1,
      fragmentNames: ['body'],
    });
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('is a no-op when versionId is undefined (no cache entry was written)', async () => {
    await expect(
      invalidateCachedDocumentFragments({
        docId: `noop-${crypto.randomUUID()}`,
        versionId: undefined,
        fragmentNames: ['body'],
      }),
    ).resolves.toBeUndefined();
  });

  it('tolerates invalidating an entry that was never cached', async () => {
    await expect(
      invalidateCachedDocumentFragments({
        docId: `unseeded-${crypto.randomUUID()}`,
        versionId: 99,
        fragmentNames: ['body'],
      }),
    ).resolves.toBeUndefined();
  });

  it('does not cache a thrown fetch — the next read re-tries TipTap', async () => {
    const docId = `error-doc-${crypto.randomUUID()}`;
    let calls = 0;
    const { client, spy } = makeClient(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('TipTap 502');
      }
      return makeFragments('recovered');
    });

    await expect(
      getCachedDocumentFragments({
        client,
        docId,
        versionId: 5,
        fragmentNames: ['body'],
      }),
    ).rejects.toThrow('TipTap 502');

    const recovered = await getCachedDocumentFragments({
      client,
      docId,
      versionId: 5,
      fragmentNames: ['body'],
    });
    expect(recovered).toEqual(makeFragments('recovered'));
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
