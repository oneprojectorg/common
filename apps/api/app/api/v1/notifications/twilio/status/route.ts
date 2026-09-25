import { handleTwilioStatusWebhookRequest } from '@op/api';
import { CommonError } from '@op/common';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';

export const POST = async (req: NextRequest): Promise<Response> => {
  const rawBody = await req.text();
  const signature = req.headers.get('x-twilio-signature') ?? undefined;

  try {
    const { status, body } = handleTwilioStatusWebhookRequest({
      rawBody,
      signature,
      url: req.url,
    });
    return new Response(body ?? null, {
      status,
      headers: body ? { 'Content-Type': 'text/xml' } : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Twilio status webhook unhandled error', {
      error: new CommonError(message),
    });
    return new Response(null, { status: 500 });
  }
};
