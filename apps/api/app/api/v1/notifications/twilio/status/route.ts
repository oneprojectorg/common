import { handleTwilioStatusWebhookRequest } from '@op/api';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';

export const POST = async (req: NextRequest): Promise<Response> => {
  const rawBody = await req.text();
  const signature = req.headers.get('x-twilio-signature') ?? undefined;

  try {
    const { status } = handleTwilioStatusWebhookRequest({
      rawBody,
      signature,
      url: req.url,
    });
    return new Response(null, { status });
  } catch (error) {
    logger.error('Twilio status webhook unhandled error', { error });
    return new Response(null, { status: 500 });
  }
};
