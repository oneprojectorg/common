import { describe, expect, it } from 'vitest';

import { readBodyWithLimit } from './readBodyWithLimit';

const URL = 'https://example.org/hook';

const streamOf = (chunks: Array<string>, onCancel: () => void) =>
  new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk === undefined) {
        controller.close();
      } else {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
    },
    cancel: onCancel,
  });

describe('readBodyWithLimit', () => {
  it('returns a body at the limit as text', async () => {
    const request = new Request(URL, { method: 'POST', body: 'é'.repeat(5) });

    await expect(readBodyWithLimit({ request, maxBytes: 10 })).resolves.toBe(
      'ééééé',
    );
  });

  it('returns an empty string for a request without a body', async () => {
    await expect(
      readBodyWithLimit({ request: new Request(URL), maxBytes: 10 }),
    ).resolves.toBe('');
  });

  it('stops reading and cancels the stream once a chunked body passes the limit', async () => {
    let isCancelled = false;
    const request = new Request(URL, {
      method: 'POST',
      body: streamOf(['12345', '67890', 'never read'], () => {
        isCancelled = true;
      }),
      // @ts-expect-error -- Node needs `duplex` for a streaming request body.
      duplex: 'half',
    });

    await expect(
      readBodyWithLimit({ request, maxBytes: 8 }),
    ).resolves.toBeUndefined();
    expect(isCancelled).toBe(true);
  });
});
