import { sendAuthCodeEmail, updateUserLocale } from '@op/common';
import { signUpConfirmedUser } from '@op/common/testing';
import { logger } from '@op/logging';
import { randomBytes, randomUUID } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleSendEmailHookRequest } from './handleSendEmailHookRequest';

vi.mock('@op/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@op/common')>()),
  sendAuthCodeEmail: vi.fn(),
}));

const sendMock = vi.mocked(sendAuthCodeEmail);

const SECRET = randomBytes(32).toString('base64');

const signedRequest = (payload: unknown, secret = SECRET) => {
  const rawBody = JSON.stringify(payload);
  const id = `msg_${randomUUID()}`;
  const timestamp = new Date();

  return {
    rawBody,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': new Webhook(secret).sign(id, timestamp, rawBody),
    },
  };
};

const hookPayload = ({
  emailActionType = 'magiclink',
  token = '0123456789',
  tokenNew = '',
  user = {},
}: {
  emailActionType?: string;
  token?: string;
  tokenNew?: string;
  user?: Record<string, unknown>;
} = {}) => ({
  user: {
    id: randomUUID(),
    email: 'person@example.com',
    user_metadata: {},
    ...user,
  },
  email_data: {
    token,
    token_hash: 'hash',
    token_new: tokenNew,
    token_hash_new: '',
    redirect_to: 'http://localhost:3100',
    email_action_type: emailActionType,
    site_url: 'http://localhost:56321/auth/v1',
  },
});

const sentEmails = () => sendMock.mock.calls.map(([email]) => email);

beforeEach(() => {
  process.env.SEND_EMAIL_HOOK_SECRET = `v1,whsec_${SECRET}`;
  sendMock.mockReset().mockResolvedValue({ transport: 'primary' });
});

afterEach(() => {
  delete process.env.SEND_EMAIL_HOOK_SECRET;
});

describe('handleSendEmailHookRequest', () => {
  it('sends the login code to the account address and answers GoTrue with an empty 200', async () => {
    const result = await handleSendEmailHookRequest(
      signedRequest(hookPayload({ token: '4815162342' })),
    );

    expect(result).toEqual({ status: 200, body: {} });
    expect(sentEmails()).toEqual([
      expect.objectContaining({
        to: 'person@example.com',
        code: '4815162342',
        locale: 'en',
        subject: 'Your login code',
      }),
    ]);
  });

  it('sends a confirmation email for a signup', async () => {
    await handleSendEmailHookRequest(
      signedRequest(hookPayload({ emailActionType: 'signup' })),
    );

    expect(sentEmails()[0]?.subject).toBe('Confirm your email');
  });

  it('sends an email change code to the new address of an account with no address', async () => {
    await handleSendEmailHookRequest(
      signedRequest(
        hookPayload({
          emailActionType: 'email_change',
          token: '1111111111',
          user: { email: '', new_email: 'new@example.com' },
        }),
      ),
    );

    expect(sentEmails().map(({ to, code }) => ({ to, code }))).toEqual([
      { to: 'new@example.com', code: '1111111111' },
    ]);
  });

  it('sends the token to the current address and token_new to the new one in a secure email change', async () => {
    await handleSendEmailHookRequest(
      signedRequest(
        hookPayload({
          emailActionType: 'email_change',
          token: '1111111111',
          tokenNew: '2222222222',
          user: { email: 'old@example.com', new_email: 'new@example.com' },
        }),
      ),
    );

    expect(sentEmails().map(({ to, code }) => ({ to, code }))).toEqual([
      { to: 'old@example.com', code: '1111111111' },
      { to: 'new@example.com', code: '2222222222' },
    ]);
  });

  it('writes the email in the locale stored for the account over the one in user_metadata', async ({
    onTestFinished,
  }) => {
    const { email, user } = await signUpConfirmedUser(
      `hook-locale-${randomUUID()}@oneproject.org`,
      onTestFinished,
    );
    await updateUserLocale({ authUserId: user.id, locale: 'es' });

    await handleSendEmailHookRequest(
      signedRequest(
        hookPayload({
          user: { id: user.id, email, user_metadata: { locale: 'fr' } },
        }),
      ),
    );

    expect(sentEmails()[0]?.subject).toBe('Tu código de inicio de sesión');
  });

  it('falls back to the locale in user_metadata when the account stores none', async () => {
    await handleSendEmailHookRequest(
      signedRequest(hookPayload({ user: { user_metadata: { locale: 'ar' } } })),
    );

    expect(sentEmails()[0]).toMatchObject({
      locale: 'ar',
      subject: 'رمز تسجيل الدخول الخاص بك',
    });
  });

  it('writes the email in English when no source names a supported locale', async () => {
    await handleSendEmailHookRequest(
      signedRequest(
        hookPayload({
          user: { user_metadata: { locale: { not: 'a string' } } },
        }),
      ),
    );

    expect(sentEmails()[0]?.subject).toBe('Your login code');
  });

  it('rejects a request whose body was changed after signing', async () => {
    const request = signedRequest(hookPayload());

    const result = await handleSendEmailHookRequest({
      ...request,
      rawBody: request.rawBody.replace(
        'person@example.com',
        'attacker@example.com',
      ),
    });

    expect(result.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects a request signed with another secret', async () => {
    const result = await handleSendEmailHookRequest(
      signedRequest(hookPayload(), randomBytes(32).toString('base64')),
    );

    expect(result.status).toBe(401);
  });

  it('rejects a request with no signature', async () => {
    const result = await handleSendEmailHookRequest({
      rawBody: JSON.stringify(hookPayload()),
      headers: {},
    });

    expect(result.status).toBe(401);
  });

  it('answers 503 and sends nothing when the secret is unset', async () => {
    delete process.env.SEND_EMAIL_HOOK_SECRET;

    const result = await handleSendEmailHookRequest(
      signedRequest(hookPayload()),
    );

    expect(result.status).toBe(503);
    expect(logger.error).toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects an email action type it has no template for', async () => {
    const result = await handleSendEmailHookRequest(
      signedRequest(hookPayload({ emailActionType: 'recovery' })),
    );

    expect(result).toEqual({
      status: 400,
      body: {
        error: { http_code: 400, message: 'Unsupported email action type' },
      },
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects a payload with no recipient address', async () => {
    const result = await handleSendEmailHookRequest(
      signedRequest(hookPayload({ user: { email: '' } })),
    );

    expect(result.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('answers 500 so GoTrue reports the failure when no transport sends the email', async () => {
    sendMock.mockRejectedValue(new Error('Resend is down'));

    const result = await handleSendEmailHookRequest(
      signedRequest(hookPayload()),
    );

    expect(result.status).toBe(500);
  });

  it('logs a send that needed the fallback transport', async () => {
    const primaryError = new Error('Resend is down');
    sendMock.mockResolvedValue({ transport: 'fallback', primaryError });

    const result = await handleSendEmailHookRequest(
      signedRequest(hookPayload()),
    );

    expect(result.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith(
      'Auth email sent through the fallback transport',
      { error: primaryError, emailActionType: 'magiclink' },
    );
  });
});
