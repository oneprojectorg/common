import { handleAuthEmailHookRequest } from '@op/api';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';

/**
 * Supabase Auth "Send Email" hook. GoTrue POSTs the one-time code and the
 * recipient here instead of sending its own templates; the handler verifies
 * the Standard Webhooks signature, renders the react-email source and sends it.
 */
export const POST = async (req: NextRequest): Promise<Response> => {
  try {
    const { status, body } = await handleAuthEmailHookRequest({
      request: req,
    });
    return Response.json(body, { status });
  } catch (error) {
    logger.error('[auth-email-hook] unhandled error', { error });
    return Response.json(
      { error: { http_code: 500, message: 'Unhandled error' } },
      { status: 500 },
    );
  }
};
