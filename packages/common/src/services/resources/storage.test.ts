import { cacheMany } from '@op/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getResourceSignedUrls } from './storage';

// Stub `cacheMany` so every id is treated as a cache miss: it just forwards the
// ids to `fetchMissing` and maps the result back. This isolates the batch-sign
// + result-mapping logic in `getResourceSignedUrls` from the cache tiering
// (which has its own tests in @op/cache).
vi.mock('@op/cache', () => ({
  cacheMany: vi.fn(
    async ({
      ids,
      fetchMissing,
    }: {
      ids: string[];
      fetchMissing: (missing: string[]) => Promise<Map<string, unknown>>;
    }) => {
      const fetched = await fetchMissing(ids);
      return new Map(ids.map((id) => [id, fetched.get(id) ?? null]));
    },
  ),
  cache: vi.fn(),
  invalidate: vi.fn(),
}));

const createSignedUrls = vi.fn();

vi.mock('@op/supabase/server', () => ({
  createSBServiceClient: () => ({
    storage: { from: () => ({ createSignedUrls }) },
  }),
}));

describe('getResourceSignedUrls', () => {
  beforeEach(() => {
    vi.mocked(cacheMany).mockClear();
    createSignedUrls.mockReset();
  });

  it('short-circuits without signing when there are no paths', async () => {
    const result = await getResourceSignedUrls({ filePaths: [] });

    expect(result.size).toBe(0);
    expect(cacheMany).not.toHaveBeenCalled();
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('batch-signs uncached paths in a single request and maps path → URL', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a/1.pdf', signedUrl: 'https://signed/a', error: null },
        { path: 'b/2.pdf', signedUrl: 'https://signed/b', error: null },
      ],
      error: null,
    });

    const result = await getResourceSignedUrls({
      filePaths: ['a/1.pdf', 'b/2.pdf'],
      ttlSeconds: 900,
    });

    expect(createSignedUrls).toHaveBeenCalledOnce();
    expect(createSignedUrls).toHaveBeenCalledWith(['a/1.pdf', 'b/2.pdf'], 900);
    expect(result.get('a/1.pdf')).toBe('https://signed/a');
    expect(result.get('b/2.pdf')).toBe('https://signed/b');
  });

  it('drops entries the signer failed on (null for that path)', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'ok.pdf', signedUrl: 'https://signed/ok', error: null },
        { path: 'bad.pdf', signedUrl: '', error: 'nope' },
      ],
      error: null,
    });

    const result = await getResourceSignedUrls({
      filePaths: ['ok.pdf', 'bad.pdf'],
    });

    expect(result.get('ok.pdf')).toBe('https://signed/ok');
    expect(result.get('bad.pdf')).toBeNull();
  });

  it('returns null for every path when the batch request errors', async () => {
    createSignedUrls.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });

    const result = await getResourceSignedUrls({ filePaths: ['x.pdf'] });

    expect(result.get('x.pdf')).toBeNull();
  });

  it('filters out empty paths before signing', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'real.pdf', signedUrl: 'https://signed/real', error: null },
      ],
      error: null,
    });

    await getResourceSignedUrls({ filePaths: ['', 'real.pdf'] });

    expect(createSignedUrls).toHaveBeenCalledWith(
      ['real.pdf'],
      expect.any(Number),
    );
  });
});
