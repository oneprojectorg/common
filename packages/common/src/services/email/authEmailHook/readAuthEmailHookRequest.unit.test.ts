import { describe, expect, it } from 'vitest';

import { readAuthEmailHookRequest } from './readAuthEmailHookRequest';

const post = (body: string | ReadableStream<Uint8Array> | null) =>
  new Request('http://localhost/api/v1/auth/send-email', {
    method: 'POST',
    headers: { 'Webhook-Id': 'msg_1', 'content-type': 'application/json' },
    body,
    // Required by undici for a streaming body.
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  });

describe('readAuthEmailHookRequest', () => {
  it('returns the body verbatim and the headers lower-cased', async () => {
    const rawBody = '{"a":1,"é":"ü"}';

    const read = await readAuthEmailHookRequest(post(rawBody));

    expect(read).toEqual({
      rawBody,
      headers: expect.objectContaining({
        'webhook-id': 'msg_1',
        'content-type': 'application/json',
      }),
    });
  });

  it('joins a body that arrives in several chunks', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":'));
        controller.enqueue(encoder.encode('1}'));
        controller.close();
      },
    });

    const read = await readAuthEmailHookRequest(post(stream));

    expect(read?.rawBody).toBe('{"a":1}');
  });

  it('reads an empty body as an empty string', async () => {
    const read = await readAuthEmailHookRequest(post(null));

    expect(read?.rawBody).toBe('');
  });

  it('stops reading and returns undefined once the body passes the cap', async () => {
    const encoder = new TextEncoder();
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(encoder.encode('x'.repeat(10)));
      },
    });

    const read = await readAuthEmailHookRequest(post(stream), 25);

    expect(read).toBeUndefined();
    expect(pulled).toBeLessThan(10);
  });

  it('accepts a body exactly at the cap', async () => {
    const rawBody = 'x'.repeat(25);

    const read = await readAuthEmailHookRequest(post(rawBody), 25);

    expect(read?.rawBody).toBe(rawBody);
  });
});
