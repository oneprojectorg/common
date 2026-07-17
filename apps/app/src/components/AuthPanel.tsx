'use client';

import { Button } from '@op/ui/Button';
import { Form } from '@op/ui/Form';
import { Header1 } from '@op/ui/Header';
import { TextField } from '@op/ui/TextField';
import React from 'react';
import { FcGoogle as GoogleIcon } from 'react-icons/fc';
import { LuKeyRound } from 'react-icons/lu';
import { create } from 'zustand';

import { useTranslations } from '@/lib/i18n';

/**
 * Shared building blocks for the auth panels.
 *
 * `LoginPanel` (login + signup) and `LinkAccountPanel` (anonymous-account
 * upgrade) render the same card chrome, Google button, email field and OTP
 * field, but drive completely different Supabase calls. These presentational
 * pieces are the common shell; each panel owns its own auth logic and composes
 * the body from these parts.
 */

interface AuthPanelState {
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
  reset: () => void;
}

// Single store shared by both panels. This is safe only because every
// transition between them is a full navigation (login/page.tsx renders exactly
// one, "Log in"/"Sign up" links are native anchors), which resets this
// module-level singleton. A soft navigation between the panels would leak
// state across flows — call `reset()` on mount if that ever becomes possible.
export const useAuthPanelStore = create<AuthPanelState>((set) => ({
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
  reset: () =>
    set({
      email: '',
      emailIsValid: false,
      token: undefined,
      tokenError: undefined,
      loginSuccess: false,
    }),
}));

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
      <div className="z-[999999] max-h-full w-auto min-w-xs rounded-lg border-offWhite bg-white bg-clip-padding px-4 py-8 font-sans text-neutral-gray4 xs:w-96 sm:border-0">
        <div className="flex flex-col gap-12 sm:gap-8">
          <section className="flex flex-col items-center justify-center gap-2 sm:gap-4">
            <Header1 className="text-center text-neutral-black">
              {title}
            </Header1>
            <div className="px-4 text-center text-sm leading-[130%] text-neutral-gray4 sm:text-base">
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
export const AuthGoogleButton = ({
  onPress,
  isDisabled,
}: {
  onPress: () => void;
  isDisabled?: boolean;
}) => {
  const t = useTranslations();

  return (
    <Button
      color="secondary"
      variant="icon"
      className="w-full text-neutral-charcoal"
      onPress={onPress}
      isDisabled={isDisabled}
    >
      <GoogleIcon className="size-4 stroke-none" />
      {t('Continue with Google')}
    </Button>
  );
};

/** "Continue with {provider}" button for the deployment's OIDC provider. */
export const AuthOIDCButton = ({
  providerName,
  onPress,
  isDisabled,
}: {
  providerName: string;
  onPress: () => void;
  isDisabled?: boolean;
}) => {
  const t = useTranslations();

  return (
    <Button
      color="secondary"
      variant="icon"
      className="w-full text-neutral-charcoal"
      onPress={onPress}
      isDisabled={isDisabled}
    >
      <LuKeyRound className="size-4" />
      {t('Continue with {provider}', { provider: providerName })}
    </Button>
  );
};

/** "or" divider, sits between the email and Google sign-in options. */
export const AuthDivider = () => {
  const t = useTranslations();

  return (
    <div className="flex w-full items-center justify-center gap-4">
      <div className="h-px grow bg-neutral-gray1" />
      <span className="text-sm text-neutral-gray4">{t('or')}</span>
      <div className="h-px grow bg-neutral-gray1" />
    </div>
  );
};

/** Email entry field wrapped in a submit-on-enter form. */
export const AuthEmailField = ({
  label,
  value,
  isDisabled,
  onChange,
  onSubmit,
  placeholder = 'admin@yourorganization.org',
}: {
  label: string;
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) => {
  const t = useTranslations();

  return (
    <div className="flex flex-col">
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSubmit();
        }}
      >
        <TextField
          aria-label={t('Email')}
          label={label}
          isRequired
          type="email"
          inputProps={{
            placeholder,
            spellCheck: false,
          }}
          autoFocus
          defaultValue={undefined}
          isDisabled={isDisabled}
          value={value}
          onChange={onChange}
        />
      </Form>
    </div>
  );
};

/** OTP entry field wrapped in a submit-on-enter form. */
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
    <div className="flex flex-col">
      <Form
        onSubmit={async (e) => {
          if (isValidOtpLength(value)) {
            e.preventDefault();
            e.stopPropagation();
            await onSubmit();
          }
        }}
      >
        <TextField
          aria-label={t('Code')}
          inputProps={{
            placeholder: '1234567890',
            spellCheck: false,
          }}
          fieldClassName="h-auto"
          autoFocus
          defaultValue={undefined}
          isDisabled={isDisabled}
          value={value}
          onChange={(val) => onChange(val.trim())}
        />
      </Form>
    </div>
  );
};
