import {
  type AuthEmailHookRequest,
  type AuthEmailHookResult,
  handleAuthEmailHook,
  sendAuthEmail,
} from '@op/common';

export type { AuthEmailHookRequest, AuthEmailHookResult };

/**
 * Wires the Supabase Auth "Send Email" hook handler with the configured
 * secrets and the real mailer. The HTTP route (apps/api) reads the raw request
 * and delegates here.
 */
export const handleAuthEmailHookRequest = (
  request: AuthEmailHookRequest,
): Promise<AuthEmailHookResult> =>
  handleAuthEmailHook(request, {
    secrets: process.env.SEND_EMAIL_HOOK_SECRETS,
    sendAuthEmail,
  });
