import { AuthCodeEmail, OPNodemailerWithFallback, render } from '@op/emails';
import { describe, expect, it, vi } from 'vitest';

import { sendAuthCodeEmail } from './sendAuthCodeEmail';

vi.mock('@op/emails', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@op/emails')>()),
  OPNodemailerWithFallback: vi.fn(async () => ({ transport: 'primary' })),
}));

describe('sendAuthCodeEmail', () => {
  it('renders the email in the locale and its text direction', async () => {
    await sendAuthCodeEmail({
      to: 'person@example.com',
      code: '4815162342',
      locale: 'ar',
      subject: 'رمز تسجيل الدخول الخاص بك',
      copy: AuthCodeEmail.PreviewProps.copy,
    });

    const [email] = vi.mocked(OPNodemailerWithFallback).mock.calls[0] ?? [];
    expect(email).toMatchObject({
      to: 'person@example.com',
      subject: 'رمز تسجيل الدخول الخاص بك',
    });

    const html = email ? await render(email.component()) : '';
    const htmlTag = html.match(/<html[^>]*>/)?.[0];
    expect(htmlTag).toContain('lang="ar"');
    expect(htmlTag).toContain('dir="rtl"');
  });
});
