import {
  type AuthEmailHookResult,
  type AuthEmailSend,
  handleAuthEmailHook,
  sendAuthEmail,
} from '@op/common';

/**
 * Wires the Supabase Auth "Send Email" hook handler with the configured
 * secrets and the real mailer. The HTTP route (apps/api) passes the request
 * through and turns the result into a response. The body is read verbatim
 * because the signature covers its exact bytes.
 */
export const handleAuthEmailHookRequest = async ({
  request,
  send = sendAuthEmail,
}: {
  request: Request;
  /** Test seam; production uses the real mailer. */
  send?: (send: AuthEmailSend) => Promise<void>;
}): Promise<AuthEmailHookResult> => {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return handleAuthEmailHook({
    rawBody,
    headers,
    secrets: process.env.SEND_EMAIL_HOOK_SECRETS,
    sendAuthEmail: send,
  });
};
