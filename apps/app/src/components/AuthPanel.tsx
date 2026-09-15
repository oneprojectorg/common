'use client';

import { Button } from '@op/sense/Button';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Header1 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@op/sense/InputOTP';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import React, { useId } from 'react';
import { FcGoogle as GoogleIcon } from 'react-icons/fc';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useTranslations, type TranslateFn } from '@/lib/i18n';

/**
 * Shared building blocks for the auth panels. `LoginPanel` (login + signup),
 * `JoinAccountModal` (claim), and `LinkAccountPanel` (anonymous upgrade) each
 * own their auth logic and compose the body from these parts.
 */

/** Which credential the visitor is signing in with. */
export type AuthChannel = 'email' | 'phone';

interface AuthPanelState {
  channel: AuthChannel;
  setChannel: (channel: AuthChannel) => void;
  phone: string;
  setPhone: (phone: string) => void;
  phoneCodeSent: boolean;
  setPhoneCodeSent: (phoneCodeSent: boolean) => void;
  email: string;
  setEmail: (email: string) => void;
  emailIsValid: boolean;
  setEmailIsValid: (emailIsValid: boolean) => void;
  token: string | undefined;
  setToken: (token: string | undefined) => void;
  tokenError: string | undefined;
  setTokenError: (tokenError: string | undefined) => void;
  loginSuccess: boolean;
  setLoginSuccess: (loginSuccess: boolean) => void;
  /**
   * Drops a pending phone verification.
   *
   * The persisted fields outlive the panel that started them, so a panel that
   * does not own the flow calls this rather than showing a code field for a
   * verification the visitor did not begin here.
   */
  clearPhoneFlow: () => void;
  reset: () => void;
}

// Single store shared by both panels. A full navigation between them once
// reset it, because it is a module-level singleton — but the persisted fields
// below survive that, deliberately, so a person can leave for their messages
// and come back. A panel that does not own a pending phone verification must
// therefore clear it on mount; `LoginPanel` calls `clearPhoneFlow` for that.
/**
 * State for the login panel, shared by both channels.
 *
 * The phone fields persist to session storage, and the email fields do not.
 * Reading an SMS code means leaving the page, and a mobile browser often
 * discards it while the person is in their messages. Without this, they return
 * to an empty email form and no way to finish signing in.
 *
 * Session storage rather than local storage, so a pending verification dies
 * with the tab and no phone number outlives it on a shared machine. The code
 * and any error stay out of storage: both are short-lived, and a stale code is
 * worse than an empty field.
 */
export const useAuthPanelStore = create<AuthPanelState>()(
  persist(
    (set) => ({
      channel: 'email',
      setChannel: (channel) => set({ channel }),
      phone: '',
      setPhone: (phone) => set({ phone }),
      phoneCodeSent: false,
      setPhoneCodeSent: (phoneCodeSent) => set({ phoneCodeSent }),
      email: '',
      setEmail: (email) => set({ email }),
      emailIsValid: false,
      setEmailIsValid: (emailIsValid) => set({ emailIsValid }),
      token: undefined,
      setToken: (token) => set({ token }),
      tokenError: undefined,
      setTokenError: (tokenError) => set({ tokenError }),
      loginSuccess: false,
      setLoginSuccess: (loginSuccess) => set({ loginSuccess }),
      clearPhoneFlow: () =>
        set({ channel: 'email', phone: '', phoneCodeSent: false }),
      reset: () =>
        set({
          channel: 'email',
          phone: '',
          phoneCodeSent: false,
          email: '',
          emailIsValid: false,
          token: undefined,
          tokenError: undefined,
          loginSuccess: false,
        }),
    }),
    {
      name: 'op-auth-panel',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        channel: state.channel,
        phone: state.phone,
        phoneCodeSent: state.phoneCodeSent,
      }),
    },
  ),
);

// Supabase OTP length is configurable between 6-10 digits
// https://supabase.com/docs/guides/local-development/cli/config#auth.email.otp_length
export function isValidOtpLength(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  return token.length >= 6 && token.length <= 10;
}

/** Outer card + centered title/subtitle section. The body is `children`. */
export const AuthPanelShell = ({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    // TODO: using a tailwind v4 class here "min-w-xs"
    <div className="flex items-center justify-center sm:block">
      <div className="z-[999999] max-h-full w-auto min-w-xs rounded-lg border-border bg-white bg-clip-padding px-4 py-8 font-sans xs:w-96 sm:border-0 sm:px-0">
        <div className="flex flex-col gap-12 sm:gap-8">
          <section className="flex flex-col items-center justify-center gap-2 sm:gap-4">
            <Header1 className="text-center sm:text-headline">{title}</Header1>
            <div className="px-4 text-center text-sm leading-[130%] text-muted-foreground sm:text-base">
              {subtitle}
            </div>
          </section>

          <section className="flex flex-col gap-8">{children}</section>
        </div>
      </div>
    </div>
  );
};

/** "Continue with Google" button. */
export const AuthGoogleButton = ({ onPress }: { onPress: () => void }) => {
  const t = useTranslations();

  return (
    <Button variant="outline" className="w-full" onClick={onPress}>
      <GoogleIcon className="size-4 stroke-none" />
      {t('auth.googleSignInAction')}
    </Button>
  );
};

/** "or" divider, sits between the email and Google sign-in options. */
export const AuthDivider = () => {
  const t = useTranslations();

  return (
    <div className="flex w-full items-center justify-center gap-4">
      <div className="h-px grow bg-secondary" />
      <span className="text-sm text-muted-foreground">{t('or')}</span>
      <div className="h-px grow bg-secondary" />
    </div>
  );
};

/** Email entry field wrapped in a submit-on-enter form. */
export const AuthEmailField = ({
  label,
  description,
  value,
  isDisabled,
  onChange,
  onSubmit,
  placeholder = 'admin@yourorganization.org',
}: {
  label: string;
  description?: string;
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) => {
  const t = useTranslations();

  return (
    <div className="flex flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSubmit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="auth-email">
            {label}
            <RequiredAsterisk />
          </FieldLabel>
          <Input
            id="auth-email"
            aria-label={t('Email')}
            aria-required
            type="email"
            placeholder={placeholder}
            spellCheck={false}
            autoFocus
            disabled={isDisabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
        </Field>
      </form>
    </div>
  );
};

/**
 * The phone number field on the login panel.
 *
 * Mirrors {@link AuthEmailField}. GoTrue hands the number to Twilio Verify,
 * which requires E.164, so the placeholder shows that shape.
 * `normalizePhoneNumber` accepts what people actually type and converts it.
 */
export const AuthPhoneField = ({
  label,
  description,
  value,
  isDisabled,
  onChange,
  onSubmit,
  placeholder = '+15551234567',
}: {
  label: string;
  description?: string;
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) => {
  return (
    <div className="flex flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSubmit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="auth-phone">
            {label}
            <RequiredAsterisk />
          </FieldLabel>
          <Input
            id="auth-phone"
            // Follows the visible label rather than repeating a fixed string:
            // `aria-label` overrides the `FieldLabel` above, so a caller that
            // passes a different label would otherwise be announced as
            // something the screen does not show.
            aria-label={label}
            aria-required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={placeholder}
            spellCheck={false}
            autoFocus
            disabled={isDisabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
        </Field>
      </form>
    </div>
  );
};

// Matches the `otp_length` set to 6 in every supabase/*.toml.
const OTP_LENGTH = 6;
// input-otp's REGEXP_ONLY_DIGITS, inlined to avoid a direct dependency on the package.
const DIGITS_ONLY_PATTERN = '^\\d+$';

/** 6-digit OTP entry field; submits automatically once all slots are filled. */
export const AuthCodeField = ({
  value,
  isDisabled,
  onChange,
  onSubmit,
}: {
  value: string | undefined;
  isDisabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}) => {
  const t = useTranslations();

  return (
    <Field>
      <FieldLabel htmlFor="auth-code">{t('6-digit code')}</FieldLabel>
      <InputOTP
        id="auth-code"
        containerClassName="justify-center"
        maxLength={OTP_LENGTH}
        pattern={DIGITS_ONLY_PATTERN}
        aria-label={t('6-digit code')}
        autoFocus
        disabled={isDisabled}
        value={value ?? ''}
        onChange={onChange}
        onComplete={() => {
          void onSubmit();
        }}
      >
        <InputOTPGroup>
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </Field>
  );
};

// ── Shared steps ───────────────────────────────────────────────────────────
// The contact and code steps, shared by the login panel and the claim dialog.

/**
 * "We sent a code to {contact}" for the active channel. One string read by
 * both the visible copy and the live region, so they cannot drift.
 */
export const codeSentToLabel = (
  t: TranslateFn,
  { isPhone, phone, email }: { isPhone: boolean; phone: string; email: string },
): string =>
  isPhone
    ? t('auth.codeSentToPhone', { phone })
    : t('auth.codeSentToEmail', { email });

/**
 * Announces where the code went. Must stay mounted, empty until the code
 * step — a live region only announces a change it was present for.
 */
export const CodeSentAnnouncement = ({ sentTo }: { sentTo?: string }) => (
  <span role="status" className="sr-only">
    {sentTo ?? ''}
  </span>
);

/** One contact field's state and handlers, as handed to AuthContactFields. */
interface ContactField {
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * The contact step: channel tabs (SMS on) or the email field alone.
 * `onValueChange` receives the new channel; the caller must clear both
 * fields, since a half-entered address must not hit the wrong endpoint.
 */
export const AuthContactFields = ({
  smsEnabled,
  value,
  onValueChange,
  email,
  phone,
  isTriggersDisabled = false,
}: {
  smsEnabled: boolean;
  value: AuthChannel;
  onValueChange: (channel: AuthChannel) => void;
  email: ContactField;
  phone: ContactField;
  /** Disables both triggers (the claim dialog does this while submitting). */
  isTriggersDisabled?: boolean;
}) => {
  const t = useTranslations();
  const labelId = useId();

  // The design mock says "We'll email a link"; we send a six-digit code, so
  // the copy says code.
  const emailField = (
    <AuthEmailField
      label={t('Email')}
      description={t('auth.emailOwnershipHint')}
      placeholder={t('name@example.com')}
      value={email.value}
      isDisabled={email.isDisabled}
      onChange={email.onChange}
      onSubmit={email.onSubmit}
    />
  );

  if (!smsEnabled) {
    return emailField;
  }

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        // Tabs reports a plain string; only the two channels are real.
        const nextChannel: AuthChannel | undefined =
          next === 'email' || next === 'phone' ? next : undefined;
        if (nextChannel && nextChannel !== value) {
          onValueChange(nextChannel);
        }
      }}
    >
      <span id={labelId} className="text-label">
        {t('auth.continueWithLabel')}
      </span>
      {/* TabsList is `w-fit` by default; both surfaces split the full width. */}
      <TabsList className="w-full" aria-labelledby={labelId}>
        <TabsTrigger
          value="email"
          className="flex-1"
          disabled={isTriggersDisabled}
        >
          {t('Email')}
        </TabsTrigger>
        <TabsTrigger
          value="phone"
          className="flex-1"
          disabled={isTriggersDisabled}
        >
          {t('auth.phoneNumberLabel')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="email">{emailField}</TabsContent>
      <TabsContent value="phone">
        <AuthPhoneField
          label={t('auth.phoneNumberLabel')}
          description={t('auth.smsRatesHint')}
          value={phone.value}
          isDisabled={phone.isDisabled}
          onChange={phone.onChange}
          onSubmit={phone.onSubmit}
        />
      </TabsContent>
    </Tabs>
  );
};

/** The contact step's primary CTA: "Email me a code" / "Text me a code". */
export const AuthSendCodeButton = ({
  isPhone,
  isBusy,
  isDisabled,
  onSubmit,
}: {
  isPhone: boolean;
  isBusy: boolean;
  isDisabled: boolean;
  onSubmit: () => void;
}) => {
  const t = useTranslations();

  return (
    <Button
      className="w-full"
      loading={isBusy}
      disabled={isDisabled}
      onClick={onSubmit}
    >
      {isPhone ? t('auth.textCodeAction') : t('auth.emailCodeAction')}
    </Button>
  );
};

/**
 * The code step's actions: verify, resend, change contact. A fragment, so
 * each surface keeps its own container.
 */
export const AuthCodeStepActions = ({
  isVerifyDisabled,
  isBusy,
  isPhone,
  onVerify,
  onResend,
  onBack,
}: {
  /** Left to the caller — not every flow disables verify the same way. */
  isVerifyDisabled: boolean;
  isBusy: boolean;
  isPhone: boolean;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}) => {
  const t = useTranslations();

  return (
    <>
      <Button
        className="w-full"
        loading={isBusy}
        disabled={isBusy || isVerifyDisabled}
        onClick={onVerify}
      >
        {t('auth.verifyAction')}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        disabled={isBusy}
        onClick={onResend}
      >
        {t('auth.resendCodeAction')}
      </Button>
      <Button variant="link" disabled={isBusy} onClick={onBack}>
        {isPhone ? t('auth.changePhoneAction') : t('auth.useEmailAction')}
      </Button>
    </>
  );
};
