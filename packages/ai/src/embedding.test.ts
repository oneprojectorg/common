import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEmbeddings } from './embedding';

const ENDPOINT = 'https://inference.example.com/v1';

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('createEmbeddings', () => {
  it('returns one vector per input without calling the endpoint for an empty batch', async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [] }));

    await expect(
      createEmbeddings({
        model: { modelId: 'embed-1', baseURL: ENDPOINT, apiKey: 'key' },
        texts: [],
      }),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the batch to /embeddings and returns the vectors', async () => {
    const fetchMock = stubFetch(
      jsonResponse({
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] },
        ],
      }),
    );

    await expect(
      createEmbeddings({
        model: { modelId: 'embed-1', baseURL: ENDPOINT, apiKey: 'key' },
        texts: ['bike lanes', 'tree canopy'],
      }),
    ).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${ENDPOINT}/embeddings`);
    expect(init.headers.Authorization).toBe('Bearer key');
    expect(JSON.parse(init.body)).toEqual({
      model: 'embed-1',
      input: ['bike lanes', 'tree canopy'],
    });
  });

  it('does not send an Authorization header for a keyless endpoint', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ data: [{ index: 0, embedding: [0.5] }] }),
    );

    await createEmbeddings({
      model: { modelId: 'embed-1', baseURL: ENDPOINT, apiKey: '' },
      texts: ['bike lanes'],
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('restores request order from the entry index', async () => {
    stubFetch(
      jsonResponse({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      }),
    );

    await expect(
      createEmbeddings({
        model: { modelId: 'embed-1', baseURL: ENDPOINT, apiKey: 'key' },
        texts: ['bike lanes', 'tree canopy'],
      }),
    ).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('throws on a non-2xx response', async () => {
    stubFetch(
      new Response('nope', { status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(
      createEmbeddings({
        model: { modelId: 'embed-1', baseURL: ENDPOINT, apiKey: 'key' },
        texts: ['bike lanes'],
      }),
    ).rejects.toThrow('429');
  });

  it('throws when the response is not numeric vectors', async () => {
    stubFetch(jsonResponse({ data: [{ index: 0, embedding: ['nope'] }] }));

    await expect(
      createEmbeddings({
        model: { modelId: 'embed-1', baseURL: ENDPOINT, apiKey: 'key' },
        texts: ['bike lanes'],
      }),
    ).rejects.toThrow('numeric vectors');
  });

  it('throws when the endpoint returns fewer vectors than inputs', async () => {
    stubFetch(jsonResponse({ data: [{ index: 0, embedding: [0.1] }] }));

    await expect(
      createEmbeddings({
        model: { modelId: 'embed-1', baseURL: ENDPOINT, apiKey: 'key' },
        texts: ['bike lanes', 'tree canopy'],
      }),
    ).rejects.toThrow('1 vectors for 2 inputs');
  });

  it('surfaces the unconfigured-endpoint error from the model resolver', async () => {
    vi.stubEnv('AI_BASE_URL', '');
    stubFetch(jsonResponse({ data: [] }));

    await expect(
      createEmbeddings({
        model: { modelId: 'embed-1' },
        texts: ['bike lanes'],
      }),
    ).rejects.toThrow('No inference URL configured');
  });
});
