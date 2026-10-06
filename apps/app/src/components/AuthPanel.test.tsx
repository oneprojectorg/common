// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../lib/i18n/dictionaries/en.json';
import type { AuthChannel } from './AuthPanel';

type AuthCodeFieldComponent = (typeof import('./AuthPanel'))['AuthCodeField'];

/**
 * Loads the field against a deployment whose two services issue codes of
 * different lengths. `@op/core` reads the lengths once at import, so the
 * module registry is reset and the panel imported fresh.
 */
const loadAuthCodeField = async ({
  emailLength,
  smsLength,
}: {
  emailLength: number;
  smsLength: number;
}): Promise<AuthCodeFieldComponent> => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_AUTH_EMAIL_OTP_LENGTH', String(emailLength));
  vi.stubEnv('NEXT_PUBLIC_AUTH_SMS_OTP_LENGTH', String(smsLength));
  const { AuthCodeField } = await import('./AuthPanel');
  return AuthCodeField;
};

const renderCodeField = ({
  AuthCodeField,
  channel,
  onSubmit,
}: {
  AuthCodeField: AuthCodeFieldComponent;
  channel: AuthChannel;
  onSubmit: () => void;
}) => {
  const Harness = () => {
    const [value, setValue] = useState('');
    return (
      <AuthCodeField
        channel={channel}
        value={value}
        isDisabled={false}
        onChange={setValue}
        onSubmit={onSubmit}
      />
    );
  };

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness />
    </NextIntlClientProvider>,
  );
};

const countSlots = (container: HTMLElement): number =>
  container.querySelectorAll('[data-slot="input-otp-slot"]').length;

describe('AuthCodeField', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * Given a deployment whose Supabase project emails a 10-digit code while
   * Twilio Verify texts a 6-digit one
   * When the field renders for the email channel and the person types the
   * emailed code
   * Then the field holds all ten digits and submits once
   */
  it('sizes the email field to the email code, not the SMS code', async () => {
    const AuthCodeField = await loadAuthCodeField({
      emailLength: 10,
      smsLength: 6,
    });
    const onSubmit = vi.fn();
    const { container } = renderCodeField({
      AuthCodeField,
      channel: 'email',
      onSubmit,
    });

    expect(countSlots(container)).toBe(10);

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Code',
    });
    await userEvent.type(input, '5404043206');

    expect(input.value).toBe('5404043206');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  /**
   * Given the same deployment
   * When the field renders for the phone channel and the person types the
   * texted code
   * Then the field holds six digits and submits once
   */
  it('sizes the phone field to the SMS code, not the email code', async () => {
    const AuthCodeField = await loadAuthCodeField({
      emailLength: 10,
      smsLength: 6,
    });
    const onSubmit = vi.fn();
    const { container } = renderCodeField({
      AuthCodeField,
      channel: 'phone',
      onSubmit,
    });

    expect(countSlots(container)).toBe(6);

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Code',
    });
    await userEvent.type(input, '234567');

    expect(input.value).toBe('234567');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
