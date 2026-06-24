import { inngest } from './client';

type InngestSendPayload = Parameters<typeof inngest.send>[0];

/**
 * Fire-and-forget wrapper around `inngest.send`. Logs and swallows errors so
 * that an Inngest brownout (or any other publish failure) never propagates
 * into a request handler that already finished its primary write.
 *
 * Callers that MUST deliver the event (e.g. moderation, vote submission)
 * should use the transactional outbox instead of, or in addition to, this
 * helper.
 */
export const safeInngestSend = (event: InngestSendPayload): Promise<void> => {
  const events = Array.isArray(event) ? event : [event];
  return inngest.send(event).then(
    () => undefined,
    (error: unknown) => {
      console.error('inngest_send_failed', {
        eventNames: events.map((e) => e.name),
        error,
      });
    },
  );
};
