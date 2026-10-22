import { handleSendEmailHookRequest, readBodyWithLimit } from '@op/api';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';

// A hook payload is a few kilobytes. The cap stops an unauthenticated caller
// from making the handler buffer a large body before the signature check.
const MAX_BODY_BYTES = 64 * 1024;

/** Supabase Auth's Send Email hook. See `handleSendEmailHookRequest`. */
export const POST = async (req: NextRequest): Promise<Response> => {
  try {
    const rawBody = await readBodyWithLimit({
      request: req,
      maxBytes: MAX_BODY_BYTES,
    });
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
    logger.error('Send Email hook unhandled error', { error });
    return Response.json(
      { error: { http_code: 500, message: 'Internal error' } },
      { status: 500 },
    );
  }
};
