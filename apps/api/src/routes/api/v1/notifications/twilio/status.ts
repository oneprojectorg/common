import { handleTwilioStatusWebhookRequest } from '@op/api';
import { CommonError } from '@op/common';
import { logger } from '@op/logging';
import { createFileRoute } from '@tanstack/react-router';

import { methodNotAllowed } from '../../../../../server/methodNotAllowed';

const POST = async (req: Request): Promise<Response> => {
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Twilio status webhook unhandled error', {
      error: new CommonError(message),
    });
    return new Response(null, { status: 500 });
  }
};

export const Route = createFileRoute('/api/v1/notifications/twilio/status')({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
      ANY: methodNotAllowed(['POST']),
    },
  },
});
