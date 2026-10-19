import { handleTwilioInboundWebhookRequest, resolveWebhookUrl } from '@op/api';
import { CommonError } from '@op/common';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';

export const POST = async (req: NextRequest): Promise<Response> => {
  const rawBody = await req.text();
  const signature = req.headers.get('x-twilio-signature') ?? undefined;

  try {
    const { status, body } = await handleTwilioInboundWebhookRequest({
      rawBody,
      signature,
      url: resolveWebhookUrl({
        url: req.url,
        headers: req.headers,
        trustForwardedHeaders: process.env.NODE_ENV !== 'production',
      }),
    });
    return new Response(body ?? null, {
      status,
      headers: body ? { 'Content-Type': 'text/xml' } : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Twilio inbound webhook unhandled error', {
      error: new CommonError(message),
    });
    return new Response(null, { status: 500 });
  }
};
