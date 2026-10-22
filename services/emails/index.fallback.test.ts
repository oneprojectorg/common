import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthCodeEmail } from './emails/AuthCodeEmail';
import { OPNodemailerWithFallback } from './index';

const { primarySendMail, fallbackSendMail } = vi.hoisted(() => ({
  primarySendMail: vi.fn(),
  fallbackSendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (url: string) => ({
      sendMail: url === 'smtp://fallback' ? fallbackSendMail : primarySendMail,
    }),
  },
}));

const email = {
  to: 'person@example.com',
  subject: 'Your login code',
  component: () => AuthCodeEmail(AuthCodeEmail.PreviewProps),
};

describe('OPNodemailerWithFallback', () => {
  beforeEach(() => {
    vi.stubEnv('EMAIL_SMTP_URL', 'smtp://primary');
    vi.stubEnv('EMAIL_FALLBACK_SMTP_URL', 'smtp://fallback');
    primarySendMail.mockReset();
    fallbackSendMail.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('sends through the primary transport when it accepts the message', async () => {
    primarySendMail.mockResolvedValue({});

    await expect(OPNodemailerWithFallback(email)).resolves.toEqual({
      transport: 'primary',
    });
    expect(fallbackSendMail).not.toHaveBeenCalled();
  });

  it('sends the same message through the fallback when the primary fails', async () => {
    const primaryError = new Error('Resend is down');
    primarySendMail.mockRejectedValue(primaryError);

    await expect(OPNodemailerWithFallback(email)).resolves.toEqual({
      transport: 'fallback',
      primaryError,
    });
    expect(fallbackSendMail).toHaveBeenCalledWith(
      primarySendMail.mock.calls[0]?.[0],
    );
  });

  it('sends through the fallback when the primary does not answer in time', async () => {
    vi.useFakeTimers();
    primarySendMail.mockReturnValue(new Promise(() => {}));

    const result = OPNodemailerWithFallback(email);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toMatchObject({ transport: 'fallback' });
  });

  it('rejects when the fallback also fails', async () => {
    primarySendMail.mockRejectedValue(new Error('Resend is down'));
    fallbackSendMail.mockRejectedValue(new Error('Fallback is down'));

    await expect(OPNodemailerWithFallback(email)).rejects.toThrow(
      'Fallback is down',
    );
  });

  it('gives up when the fallback does not answer in time either', async () => {
    vi.useFakeTimers();
    primarySendMail.mockReturnValue(new Promise(() => {}));
    fallbackSendMail.mockReturnValue(new Promise(() => {}));

    const result = OPNodemailerWithFallback(email);
    const assertion = expect(result).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(2_000 + 2_500);

    await assertion;
  });

  it('throws the primary error when no fallback is configured', async () => {
    vi.stubEnv('EMAIL_FALLBACK_SMTP_URL', '');
    primarySendMail.mockRejectedValue(new Error('Resend is down'));

    await expect(OPNodemailerWithFallback(email)).rejects.toThrow(
      'Resend is down',
    );
    expect(fallbackSendMail).not.toHaveBeenCalled();
  });

  it('waits for a slow primary when no fallback is configured', async () => {
    vi.useFakeTimers();
    vi.stubEnv('EMAIL_FALLBACK_SMTP_URL', '');
    primarySendMail.mockReturnValue(
      new Promise((resolve) => setTimeout(() => resolve({}), 3_000)),
    );

    const result = OPNodemailerWithFallback(email);
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(result).resolves.toEqual({ transport: 'primary' });
  });
});
