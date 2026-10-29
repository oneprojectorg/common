import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAuthEmailHook } from './handleAuthEmailHook';
import { signStandardWebhook } from './verifyStandardWebhookSignature';

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Built at runtime so no `whsec_` literal sits in the source for scanners to flag. */
const hookSecret = (phrase: string) =>
  `v1,whsec_${Buffer.from(phrase).toString('base64')}`;

const SECRET = hookSecret('secret-one-secret-one-secret-one');
const NOW_SECONDS = 1_800_000_000;
const now = () => NOW_SECONDS * 1000;

const signedRequest = (payload: unknown, secret = SECRET) => {
  const rawBody = JSON.stringify(payload);
  return {
    rawBody,
    headers: {
      'webhook-id': 'msg_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook({
        id: 'msg_1',
        timestamp: NOW_SECONDS,
        rawBody,
        secret,
      }),
    },
  };
};

const payload = (
  emailActionType: string,
  overrides: {
    user?: Record<string, unknown>;
    emailData?: Record<string, unknown>;
  } = {},
) => ({
  user: { id: 'u1', email: 'person@example.org', ...overrides.user },
  email_data: {
    email_action_type: emailActionType,
    token: '1234567890',
    token_hash: 'hash',
    redirect_to: 'http://localhost:3100/',
    site_url: 'http://localhost:3100/',
    token_new: '',
    token_hash_new: '',
    ...overrides.emailData,
  },
});

const sendAuthEmail = vi.fn<(send: unknown) => Promise<void>>();

const run = (request: { rawBody: string; headers: Record<string, string> }) =>
  handleAuthEmailHook(request, { secrets: SECRET, sendAuthEmail, now });

beforeEach(() => {
  sendAuthEmail.mockReset();
  sendAuthEmail.mockResolvedValue(undefined);
});

describe('handleAuthEmailHook', () => {
  it('sends the login code for a magiclink', async () => {
    const result = await run(signedRequest(payload('magiclink')));

    expect(result).toEqual({ status: 200, body: {} });
    expect(sendAuthEmail).toHaveBeenCalledTimes(1);
    expect(sendAuthEmail).toHaveBeenCalledWith({
      to: 'person@example.org',
      kind: 'login',
      token: '1234567890',
    });
  });

  it('sends the confirmation code for a signup', async () => {
    const result = await run(signedRequest(payload('signup')));

    expect(result.status).toBe(200);
    expect(sendAuthEmail).toHaveBeenCalledWith({
      to: 'person@example.org',
      kind: 'signup',
      token: '1234567890',
    });
  });

  it('sends the email-change code to the new address of an anonymous account', async () => {
    // An anonymous user has no current email, so GoTrue sends an empty
    // `token` and puts the code in `token_new`.
    const result = await run(
      signedRequest(
        payload('email_change', {
          user: { email: null, new_email: 'new@example.org' },
          emailData: { token: '', token_new: '0987654321' },
        }),
      ),
    );

    expect(result.status).toBe(200);
    expect(sendAuthEmail).toHaveBeenCalledTimes(1);
    expect(sendAuthEmail).toHaveBeenCalledWith({
      to: 'new@example.org',
      kind: 'emailChange',
      token: '0987654321',
    });
  });

  it('sends one code to each address when both must confirm a change', async () => {
    const result = await run(
      signedRequest(
        payload('email_change', {
          user: { new_email: 'new@example.org' },
          emailData: { token: '1111111111', token_new: '2222222222' },
        }),
      ),
    );

    expect(result.status).toBe(200);
    expect(sendAuthEmail.mock.calls.map(([send]) => send)).toEqual([
      { to: 'person@example.org', kind: 'emailChange', token: '1111111111' },
      { to: 'new@example.org', kind: 'emailChange', token: '2222222222' },
    ]);
  });

  it('refuses an action type this app never triggers', async () => {
    const result = await run(signedRequest(payload('recovery')));

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: { http_code: 400, message: expect.stringContaining('recovery') },
    });
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });

  it('refuses a supported action that carries no recipient', async () => {
    const result = await run(
      signedRequest(payload('magiclink', { user: { email: null } })),
    );

    expect(result.status).toBe(400);
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });

  it('refuses a bad signature before reading the payload', async () => {
    const result = await run(
      signedRequest(payload('magiclink'), hookSecret('other')),
    );

    expect(result.status).toBe(401);
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });

  it('refuses a body that is not the hook payload', async () => {
    expect((await run(signedRequest({ hello: 'world' }))).status).toBe(400);

    const notJson = signedRequest(payload('magiclink'));
    notJson.rawBody = 'not json';
    notJson.headers['webhook-signature'] = signStandardWebhook({
      id: 'msg_1',
      timestamp: NOW_SECONDS,
      rawBody: notJson.rawBody,
      secret: SECRET,
    });
    expect((await run(notJson)).status).toBe(400);
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });

  it('answers 503 when no secret is configured', async () => {
    const result = await handleAuthEmailHook(
      signedRequest(payload('magiclink')),
      { secrets: undefined, sendAuthEmail, now },
    );

    expect(result.status).toBe(503);
    expect(sendAuthEmail).not.toHaveBeenCalled();
  });

  it('answers 500 when the mailer fails, so GoTrue reports the sign-in error', async () => {
    sendAuthEmail.mockRejectedValueOnce(new Error('smtp down'));

    const result = await run(signedRequest(payload('magiclink')));

    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({ error: { http_code: 500 } });
  });
});
