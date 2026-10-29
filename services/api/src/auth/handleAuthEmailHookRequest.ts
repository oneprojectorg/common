import {
  type AuthEmailHookResult,
  type AuthEmailSend,
  handleAuthEmailHook,
  readAuthEmailHookRequest,
  sendAuthEmail,
} from '@op/common';

/**
 * Wires the Supabase Auth "Send Email" hook handler with the configured
 * secrets and the real mailer. The HTTP route (apps/api) passes the request
 * through and turns the result into a response.
 */
export const handleAuthEmailHookRequest = async ({
  request,
  send = sendAuthEmail,
}: {
  request: Request;
  /** Test seam; production uses the real mailer. */
  send?: (send: AuthEmailSend) => Promise<void>;
}): Promise<AuthEmailHookResult> => {
  const read = await readAuthEmailHookRequest(request);
  if (!read) {
    return {
      status: 400,
      body: { error: { http_code: 400, message: 'Payload too large' } },
    };
  }

  return handleAuthEmailHook({
    ...read,
    secrets: process.env.SEND_EMAIL_HOOK_SECRETS,
    sendAuthEmail: send,
  });
};
