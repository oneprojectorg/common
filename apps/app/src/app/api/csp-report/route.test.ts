import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();

vi.mock('@op/analytics', () => ({
  trackEvent: (...args: Array<unknown>) => trackEvent(...args),
}));

const { POST } = await import('./route');

const MAX_BODY_BYTES = 64_000;

const post = (body: BodyInit) =>
  POST(
    new NextRequest('https://common.oneproject.org/api/csp-report', {
      method: 'POST',
      body,
    }),
  );

/** A body with no `Content-Length`, the way a chunked request arrives. */
const streamed = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      // Chunked so the reader sees the cap passed part-way through.
      const encoded = new TextEncoder().encode(text);
      for (let at = 0; at < encoded.byteLength; at += 8_000) {
        controller.enqueue(encoded.slice(at, at + 8_000));
      }
      controller.close();
    },
  });

const report = (documentUri = 'https://common.oneproject.org/en/') =>
  JSON.stringify({
    'csp-report': {
      'document-uri': documentUri,
      'violated-directive': 'script-src',
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/csp-report', () => {
  it('forwards a report to analytics', async () => {
    const response = await post(report());

    expect(response.status).toBe(204);
    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'csp_violation',
        properties: expect.objectContaining({
          document_uri: 'https://common.oneproject.org/en/',
          effective_directive: 'script-src',
        }),
      }),
    );
  });

  it('refuses an oversized body', async () => {
    const response = await post(report('x'.repeat(MAX_BODY_BYTES)));

    expect(response.status).toBe(413);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('refuses an oversized body that declares no length', async () => {
    // The hole a Content-Length check alone leaves open: a chunked request
    // declares no length, so the cap has to hold while reading.
    const response = await post(streamed('x'.repeat(MAX_BODY_BYTES * 4)));

    expect(response.headers.get('content-length')).toBeNull();
    expect(response.status).toBe(413);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('accepts a streamed body under the cap', async () => {
    const response = await post(streamed(report()));

    expect(response.status).toBe(204);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('caps the fan-out of a report-to batch', async () => {
    const response = await post(
      JSON.stringify(
        Array.from({ length: 50 }, () => ({
          type: 'csp-violation',
          body: { documentURL: 'https://common.oneproject.org/en/' },
        })),
      ),
    );

    expect(response.status).toBe(204);
    expect(trackEvent).toHaveBeenCalledTimes(10);
  });

  it('ignores a body that is not JSON', async () => {
    const response = await post('not json');

    expect(response.status).toBe(204);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
