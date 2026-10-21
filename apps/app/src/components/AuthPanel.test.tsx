// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../lib/i18n/dictionaries/en.json';
import {
  type AuthChannel,
  AuthCodeStepActions,
  AuthContactFields,
} from './AuthPanel';

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
  error,
}: {
  AuthCodeField: AuthCodeFieldComponent;
  channel: AuthChannel;
  onSubmit: () => void;
  error?: string;
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
        error={error}
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

/**
 * `input-otp` schedules three timers (0, 10 and 50 ms) on every focus or
 * selection change and never clears them; each one calls `setState`. Vitest
 * tears jsdom down as soon as the file ends, and a timer that fires after
 * that crashes React with `window is not defined` as an unhandled error. A
 * timer queued after theirs fires after theirs, so waiting on one is enough.
 */
const flushInputOtpTimers = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 60);
  });

describe('AuthCodeField', () => {
  afterEach(async () => {
    cleanup();
    await flushInputOtpTimers();
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
      name: 'Enter verification code',
    });
    await userEvent.type(input, '5404043206');

    expect(input.value).toBe('5404043206');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  /**
   * Given a code copied out of the email, which brings the surrounding
   * whitespace and a line break along with the digits
   * When the person pastes it into the email field
   * Then the field holds the ten digits and submits once, instead of
   * rejecting the paste for the characters around them
   */
  it('accepts a pasted email code with whitespace around it', async () => {
    const AuthCodeField = await loadAuthCodeField({
      emailLength: 10,
      smsLength: 6,
    });
    const onSubmit = vi.fn();
    renderCodeField({ AuthCodeField, channel: 'email', onSubmit });

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Enter verification code',
    });
    await userEvent.click(input);
    await userEvent.paste(' 5404043206\n');

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
      name: 'Enter verification code',
    });
    await userEvent.type(input, '234567');

    expect(input.value).toBe('234567');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows an "Enter verification code" label linked to the code field', async () => {
    const AuthCodeField = await loadAuthCodeField({
      emailLength: 6,
      smsLength: 6,
    });
    renderCodeField({ AuthCodeField, channel: 'email', onSubmit: vi.fn() });

    const label = screen.getByText('Enter verification code');
    const input = screen.getByLabelText<HTMLInputElement>(
      'Enter verification code',
    );

    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-label')).toBeNull();
  });

  it('given the code was rejected, then the field is marked invalid and the message is announced centred inside it', async () => {
    const AuthCodeField = await loadAuthCodeField({
      emailLength: 6,
      smsLength: 6,
    });
    renderCodeField({
      AuthCodeField,
      channel: 'phone',
      onSubmit: vi.fn(),
      error: 'That code expired. Request a new one.',
    });

    const input = screen.getByRole('textbox', {
      name: 'Enter verification code',
    });
    const field = screen.getByRole('group');
    const alert = screen.getByRole('alert');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('data-invalid')).toBe('true');
    expect(field.contains(alert)).toBe(true);
    expect(alert.textContent).toBe('That code expired. Request a new one.');
    expect(alert.classList.contains('text-center')).toBe(true);
  });

  it('given no code was rejected, then the field is not marked invalid', async () => {
    const AuthCodeField = await loadAuthCodeField({
      emailLength: 6,
      smsLength: 6,
    });
    renderCodeField({ AuthCodeField, channel: 'phone', onSubmit: vi.fn() });

    const input = screen.getByRole('textbox', {
      name: 'Enter verification code',
    });

    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByRole('group').getAttribute('data-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('AuthContactFields', () => {
  afterEach(() => {
    cleanup();
  });

  const contactField = (error?: string) => ({
    value: '',
    isDisabled: false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    error,
  });

  const renderContactFields = ({
    channel,
    email,
    phone,
  }: {
    channel: AuthChannel;
    email?: string;
    phone?: string;
  }) =>
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthContactFields
          smsEnabled
          value={channel}
          onValueChange={vi.fn()}
          email={contactField(email)}
          phone={contactField(phone)}
        />
      </NextIntlClientProvider>,
    );

  it('given the phone request failed, then the message sits below the phone input in the field error state', () => {
    renderContactFields({
      channel: 'phone',
      phone: 'An account with this phone number already exists.',
    });

    const input = screen.getByRole('textbox', { name: 'Phone Number' });
    const field = screen.getByRole('group');
    const alert = screen.getByRole('alert');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('data-invalid')).toBe('true');
    expect(field.contains(alert)).toBe(true);
    expect(
      input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(alert.textContent).toBe(
      'An account with this phone number already exists.',
    );
  });

  it('given the email request failed, then the message sits below the email input in the field error state', () => {
    renderContactFields({
      channel: 'email',
      email: 'An account with this email already exists.',
    });

    const input = screen.getByRole('textbox', { name: 'Email' });
    const field = screen.getByRole('group');
    const alert = screen.getByRole('alert');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('data-invalid')).toBe('true');
    expect(field.contains(alert)).toBe(true);
    expect(
      input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('given no request failed, then neither contact input is marked invalid', () => {
    renderContactFields({ channel: 'phone' });

    expect(
      screen
        .getByRole('textbox', { name: 'Phone Number' })
        .getAttribute('aria-invalid'),
    ).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

const renderCodeStepActions = ({
  canSwitchChannel,
  isLoading = false,
  onBack = vi.fn(),
}: {
  canSwitchChannel: boolean;
  isLoading?: boolean;
  onBack?: () => void;
}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthCodeStepActions
        isVerifyDisabled={false}
        isLoading={isLoading}
        canSwitchChannel={canSwitchChannel}
        onVerify={vi.fn()}
        onResend={vi.fn()}
        onBack={onBack}
      />
    </NextIntlClientProvider>,
  );

describe('AuthCodeStepActions', () => {
  afterEach(() => {
    cleanup();
  });

  it('given phone sign-in is on, then one link offers a different phone number or email and returns to the contact step', async () => {
    const onBack = vi.fn();
    renderCodeStepActions({ canSwitchChannel: true, onBack });

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(
      screen.queryByRole('button', { name: 'Use email instead' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Use a different phone number' }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Use a different phone number or email',
      }),
    );

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('given phone sign-in is off, then the link offers a different email address only', async () => {
    const onBack = vi.fn();
    renderCodeStepActions({ canSwitchChannel: false, onBack });

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(
      screen.queryByRole('button', {
        name: 'Use a different phone number or email',
      }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: 'Use a different email address' }),
    );

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('given a code is being verified, then changing the contact is disabled until the verification settles', () => {
    renderCodeStepActions({ canSwitchChannel: true, isLoading: true });

    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Use a different phone number or email',
      }).disabled,
    ).toBe(true);
  });
});
