import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTipTapClient as createMockTipTapClient,
  mockCollab,
  textFragment,
} from '../__mocks__/index';
import { createTipTapClient } from './client';

describe('TipTap client version creation', () => {
  beforeEach(() => {
    mockCollab.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should post explicit version creation payloads to TipTap', async () => {
    let capturedRequest:
      | {
          method: string;
          url: string;
          authorization: string | null;
          body: unknown;
        }
      | undefined;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;

      capturedRequest = {
        method: request.method,
        url: request.url,
        authorization: request.headers.get('authorization'),
        body: await request.json(),
      };

      return new Response(
        JSON.stringify({
          version: 4,
          date: 1_700_000_000_000,
          name: 'Reply to review',
          meta: { reason: 'review-reply' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = createTipTapClient({
      appId: 'test-app',
      secret: 'test-secret',
    });

    const version = await client.createVersion('proposal-123', {
      name: 'Reply to review',
      meta: { reason: 'review-reply' },
      user: 'profile-123',
    });

    expect(version).toEqual({
      version: 4,
      date: 1_700_000_000_000,
      name: 'Reply to review',
      meta: { reason: 'review-reply' },
    });

    expect(capturedRequest).toEqual({
      method: 'POST',
      url: 'https://test-app.collab.tiptap.cloud/api/documents/proposal-123/versions',
      authorization: 'test-secret',
      body: {
        name: 'Reply to review',
        meta: { reason: 'review-reply' },
        user: 'profile-123',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedRequest?.url).toBe(
      'https://test-app.collab.tiptap.cloud/api/documents/proposal-123/versions',
    );
  });

  it('should snapshot the current fragment state when the mock creates a version', async () => {
    mockCollab.setDocFragmentResponses('proposal-123', {
      title: textFragment('Initial title'),
      summary: textFragment('Initial summary'),
    });

    const client = createMockTipTapClient();
    const createdVersion = await client.createVersion('proposal-123', {
      name: 'Reply to review',
      meta: { reason: 'review-reply' },
    });

    mockCollab.setDocFragmentResponses('proposal-123', {
      title: textFragment('Updated title'),
      summary: textFragment('Updated summary'),
    });

    const versions = await client.listVersions('proposal-123');
    const snapshot = await client.getVersion(
      'proposal-123',
      createdVersion.version,
    );

    expect(versions).toEqual([
      expect.objectContaining({
        version: createdVersion.version,
        name: 'Reply to review',
        meta: { reason: 'review-reply' },
      }),
    ]);
    expect(snapshot).toEqual({
      title: textFragment('Initial title'),
      summary: textFragment('Initial summary'),
    });
  });
});
