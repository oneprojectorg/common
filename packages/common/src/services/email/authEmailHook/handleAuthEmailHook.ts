import { logger } from '@op/logging';
import { z } from 'zod';

import { verifyStandardWebhookSignature } from './verifyStandardWebhookSignature';

export interface AuthEmailHookRequest {
  rawBody: string;
  headers: Record<string, string>;
}

export type AuthEmailKind = 'signup' | 'login' | 'emailChange';

export interface AuthEmailSend {
  to: string;
  kind: AuthEmailKind;
  token: string;
}

export interface AuthEmailHookDeps {
  /** The hook's `v1,whsec_…` secrets, `|`-separated during a rotation. */
  secrets: string | undefined;
  sendAuthEmail: (send: AuthEmailSend) => Promise<void>;
  now?: () => number;
}

export interface AuthEmailHookResult {
  status: 200 | 400 | 401 | 500 | 503;
  /** GoTrue reads `error.message` from a non-2xx body and reports it to the caller. */
  body: Record<string, unknown>;
}

// Supabase caps the hook payload at 20KB uncompressed; anything larger is not GoTrue.
const MAX_BODY_BYTES = 32_000;

const payloadSchema = z.object({
  user: z.object({
    email: z.string().nullish(),
    new_email: z.string().nullish(),
  }),
  email_data: z.object({
    email_action_type: z.string(),
    token: z.string().nullish(),
    token_new: z.string().nullish(),
  }),
});

type AuthEmailHookPayload = z.infer<typeof payloadSchema>;

const failure = (
  status: Exclude<AuthEmailHookResult['status'], 200>,
  message: string,
): AuthEmailHookResult => ({
  status,
  body: { error: { http_code: status, message } },
});

/**
 * Which emails a GoTrue payload asks for. `undefined` means the action type is
 * one this app never triggers; an empty list means a supported type arrived
 * with nothing to send.
 */
const planSends = ({
  user,
  email_data: data,
}: AuthEmailHookPayload): AuthEmailSend[] | undefined => {
  const token = data.token ?? '';
  const tokenNew = data.token_new ?? '';

  switch (data.email_action_type) {
    case 'signup':
      return user.email && token
        ? [{ to: user.email, kind: 'signup', token }]
        : [];
    case 'magiclink':
    case 'email':
      return user.email && token
        ? [{ to: user.email, kind: 'login', token }]
        : [];
    case 'email_change': {
      // GoTrue pairs `token` with the current address and `token_new` with the
      // new one. An anonymous account claiming an email has no current address,
      // so only the second send applies.
      const sends: AuthEmailSend[] = [];
      if (user.email && token) {
        sends.push({ to: user.email, kind: 'emailChange', token });
      }
      if (user.new_email && tokenNew) {
        sends.push({
          to: user.new_email,
          kind: 'emailChange',
          token: tokenNew,
        });
      }
      return sends;
    }
    default:
      return undefined;
  }
};

/**
 * Supabase Auth "Send Email" hook: GoTrue POSTs the one-time code here and
 * this app renders and sends the email instead of GoTrue's own templates.
 * Pure apart from the injected sender, so the route and the tests share it.
 * Logs never carry the address or the code.
 */
export const handleAuthEmailHook = async (
  { rawBody, headers }: AuthEmailHookRequest,
  { secrets, sendAuthEmail, now = Date.now }: AuthEmailHookDeps,
): Promise<AuthEmailHookResult> => {
  if (!secrets) {
    logger.error('Auth email hook called without SEND_EMAIL_HOOK_SECRETS');
    return failure(503, 'The Send Email hook is not configured');
  }

  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return failure(400, 'Payload too large');
  }

  if (
    !verifyStandardWebhookSignature({ rawBody, headers, secrets, now: now() })
  ) {
    logger.warn('Auth email hook rejected: bad signature');
    return failure(401, 'Invalid signature');
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return failure(400, 'Malformed JSON');
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    logger.warn('Auth email hook rejected: unexpected payload');
    return failure(400, 'Unexpected payload');
  }

  const actionType = parsed.data.email_data.email_action_type;
  const sends = planSends(parsed.data);
  if (!sends) {
    logger.warn('Auth email hook: unsupported action type', { actionType });
    return failure(400, `Unsupported email action type: ${actionType}`);
  }
  if (sends.length === 0) {
    logger.warn('Auth email hook: nothing to send', { actionType });
    return failure(400, `No recipient or code for ${actionType}`);
  }

  for (const send of sends) {
    try {
      await sendAuthEmail(send);
    } catch (error) {
      logger.error('Auth email hook: send failed', {
        error,
        actionType,
        kind: send.kind,
      });
      return failure(500, 'The email could not be sent');
    }
  }

  logger.info('Auth email hook sent', { actionType, count: sends.length });
  return { status: 200, body: {} };
};
