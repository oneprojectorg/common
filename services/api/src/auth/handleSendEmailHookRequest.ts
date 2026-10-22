import { getUserLocale } from '@op/common';
import {
  type SupportedLocale,
  getLocaleDirection,
  isSupportedLocale,
} from '@op/common/locales';
import { AuthCodeEmail, OPNodemailerWithFallback } from '@op/emails';
import { logger } from '@op/logging';
import { Webhook } from 'standardwebhooks';
import { z } from 'zod';

import {
  type AuthEmailMessages,
  getAuthEmailMessages,
} from './getAuthEmailMessages';

export interface SendEmailHookRequest {
  rawBody: string;
  headers: Record<string, string>;
}

interface SendEmailHookResponse {
  status: number;
  body: { error?: { http_code: number; message: string } };
}

type AuthEmailKind = 'loginCode' | 'confirmEmail' | 'emailChange';

interface AuthEmail {
  to: string;
  code: string;
  kind: AuthEmailKind;
}

type UnaddressedAuthEmail = Omit<AuthEmail, 'to'> & {
  to: string | null | undefined;
};

const sendEmailHookPayloadSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().nullish(),
    new_email: z.string().nullish(),
    // The account owner can write user_metadata, so a bad value must not
    // fail the parse and block their sign-in.
    user_metadata: z.object({ locale: z.unknown() }).partial().nullish(),
  }),
  email_data: z.object({
    token: z.string(),
    token_new: z.string().nullish(),
    email_action_type: z.string(),
  }),
});

type SendEmailHookPayload = z.infer<typeof sendEmailHookPayloadSchema>;

/**
 * Supabase Auth's Send Email hook. GoTrue posts each auth email here instead
 * of sending it, and fails the sign-in step unless this answers 200.
 */
export const handleSendEmailHookRequest = async ({
  rawBody,
  headers,
}: SendEmailHookRequest): Promise<SendEmailHookResponse> => {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    logger.error('Send Email hook called but SEND_EMAIL_HOOK_SECRET is unset');
    return errorResponse(503, 'Email hook is not configured');
  }

  let verifiedBody: unknown;
  try {
    // Supabase shows the secret as `v1,whsec_<base64>`.
    verifiedBody = new Webhook(secret.replace(/^v1,whsec_/, '')).verify(
      rawBody,
      headers,
    );
  } catch (error) {
    logger.warn('Send Email hook signature verification failed', { error });
    return errorResponse(401, 'Invalid signature');
  }

  const payload = sendEmailHookPayloadSchema.safeParse(verifiedBody);
  if (!payload.success) {
    logger.error('Send Email hook payload did not parse', {
      error: payload.error,
    });
    return errorResponse(400, 'Invalid payload');
  }

  const emailActionType = payload.data.email_data.email_action_type;
  const unaddressedEmails = getAuthEmails(payload.data);
  if (!unaddressedEmails) {
    logger.error('Send Email hook got an unsupported email action type', {
      emailActionType,
    });
    return errorResponse(400, 'Unsupported email action type');
  }

  const emails = unaddressedEmails.filter(hasRecipient);
  if (emails.length !== unaddressedEmails.length) {
    logger.error('Send Email hook payload has no recipient address', {
      emailActionType,
    });
    return errorResponse(400, 'Missing recipient address');
  }

  const locale = await resolveEmailLocale(payload.data.user);
  const messages = await getAuthEmailMessages(locale);

  try {
    for (const email of emails) {
      await sendAuthEmail({ email, locale, messages, emailActionType });
    }
  } catch (error) {
    logger.error('Send Email hook could not send an auth email', {
      error,
      emailActionType,
    });
    return errorResponse(500, 'Failed to send email');
  }

  return { status: 200, body: {} };
};

const errorResponse = (
  status: number,
  message: string,
): SendEmailHookResponse => ({
  status,
  body: { error: { http_code: status, message } },
});

const getAuthEmails = ({
  user,
  email_data: { token, token_new, email_action_type },
}: SendEmailHookPayload): Array<UnaddressedAuthEmail> | undefined => {
  switch (email_action_type) {
    case 'magiclink':
    case 'email':
      return [{ to: user.email, code: token, kind: 'loginCode' }];
    case 'signup':
      return [{ to: user.email, code: token, kind: 'confirmEmail' }];
    case 'email_change':
      // A secure change of an existing address sends a code to each address.
      // Only the token hashes are swapped in the payload, not the tokens.
      return token_new
        ? [
            { to: user.email, code: token, kind: 'emailChange' },
            { to: user.new_email, code: token_new, kind: 'emailChange' },
          ]
        : [{ to: user.new_email, code: token, kind: 'emailChange' }];
    default:
      return undefined;
  }
};

const hasRecipient = (email: UnaddressedAuthEmail): email is AuthEmail =>
  Boolean(email.to);

const resolveEmailLocale = async (
  user: SendEmailHookPayload['user'],
): Promise<SupportedLocale> => {
  const storedLocale = await getUserLocale({ authUserId: user.id });
  if (storedLocale) {
    return storedLocale;
  }

  const requestLocale = user.user_metadata?.locale;
  if (typeof requestLocale === 'string' && isSupportedLocale(requestLocale)) {
    return requestLocale;
  }

  return 'en';
};

const sendAuthEmail = async ({
  email: { to, code, kind },
  locale,
  messages,
  emailActionType,
}: {
  email: AuthEmail;
  locale: SupportedLocale;
  messages: AuthEmailMessages;
  emailActionType: string;
}) => {
  const copy = getEmailCopy({ kind, messages });
  const result = await OPNodemailerWithFallback({
    to,
    subject: copy.subject,
    component: () =>
      AuthCodeEmail({
        code,
        lang: locale,
        dir: getLocaleDirection(locale),
        copy,
      }),
  });

  if (result.transport === 'fallback') {
    logger.warn('Auth email sent through the fallback transport', {
      error: result.primaryError,
      emailActionType,
    });
  }
};

const getEmailCopy = ({
  kind,
  messages,
}: {
  kind: AuthEmailKind;
  messages: AuthEmailMessages;
}) => {
  const shared = {
    codeExpiryHint: messages.codeExpiryHint,
    supportHint: messages.supportHint,
    maintainerNote: messages.maintainerNote,
    deliveryReasonNote: messages.deliveryReasonNote,
  };

  if (kind === 'loginCode') {
    return {
      ...shared,
      subject: messages.loginCodeSubject,
      previewText: messages.loginCodePreview,
      heading: messages.loginCodeHeading,
      description: messages.loginCodeDescription,
    };
  }

  return {
    ...shared,
    subject: messages.confirmEmailSubject,
    previewText: messages.confirmEmailPreview,
    heading: messages.confirmEmailHeading,
    description:
      kind === 'emailChange'
        ? messages.emailChangeDescription
        : messages.confirmEmailDescription,
  };
};
