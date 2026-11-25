import { OPNodemailer, render } from '@op/emails';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendAuthEmail } from './sendAuthEmail';

vi.mock('@op/emails', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@op/emails')>()),
  OPNodemailer: vi.fn(),
}));

const mailer = vi.mocked(OPNodemailer);

const lastSend = () => {
  const call = mailer.mock.calls.at(-1)?.[0];
  if (!call) {
    throw new Error('OPNodemailer was not called');
  }
  return call;
};

beforeEach(() => {
  mailer.mockReset();
  mailer.mockResolvedValue(undefined);
});

describe('sendAuthEmail', () => {
  it.each([
    ['signup', 'Confirm your email', 'Confirm your email'],
    ['login', 'Your Common login code', 'Login'],
    ['emailChange', 'Confirm your email', 'Confirm your email'],
  ] as const)(
    'renders the %s email with its subject and the code',
    async (kind, subject, heading) => {
      await sendAuthEmail({
        to: 'person@example.org',
        kind,
        token: '4815162342',
      });

      const send = lastSend();
      expect(send.to).toBe('person@example.org');
      expect(send.subject).toBe(subject);

      const html = await render(send.component());
      expect(html).toContain('4815162342');
      expect(html).not.toContain('{{ .Token }}');
      expect(html).toContain(heading);
    },
  );
});
