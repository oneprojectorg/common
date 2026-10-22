import { handleSendEmailHookRequest } from '@op/api';
import { CommonError } from '@op/common';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';

// A hook payload is a few kilobytes. The cap stops an unauthenticated caller
// from making the handler buffer a large body before the signature check.
const MAX_BODY_BYTES = 64 * 1024;

/** Supabase Auth's Send Email hook. See `handleSendEmailHookRequest`. */
export const POST = async (req: NextRequest): Promise<Response> => {
  try {
    const rawBody = await readBodyWithLimit(req);
    if (rawBody === undefined) {
      return Response.json(
        { error: { http_code: 413, message: 'Payload too large' } },
        { status: 413 },
      );
    }

    const { status, body } = await handleSendEmailHookRequest({
      rawBody,
      headers: Object.fromEntries(req.headers),
    });
    return Response.json(body, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Send Email hook unhandled error', {
      error: new CommonError(message),
    });
    return Response.json(
      { error: { http_code: 500, message: 'Internal error' } },
      { status: 500 },
    );
  }
};

/** The body as text, or undefined when it is larger than `MAX_BODY_BYTES`. */
const readBodyWithLimit = async (
  req: NextRequest,
): Promise<string | undefined> => {
  if (!req.body) {
    return '';
  }

  const reader = req.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
};
