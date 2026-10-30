import { handleAuthEmailHook, sendAuthEmail } from '@op/common';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';

/** Supabase Auth "Send Email" hook: GoTrue POSTs each one-time code here and this app sends the email. */
export const POST = async (req: NextRequest): Promise<Response> => {
  try {
    const { status, body } = await handleAuthEmailHook({
      rawBody: await req.text(),
      headers: req.headers,
      secrets: process.env.SEND_EMAIL_HOOK_SECRETS,
      sendAuthEmail,
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
