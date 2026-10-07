'use client';

import { usePhoneLogin } from '@/hooks/usePhoneLogin';
import { normalizePhoneNumber, phoneNumberSchema } from '@op/common/client';
import { useCallback, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useAuthPanelStore } from '@/components/AuthPanel';

import { codeFailureMessage } from './phoneAuth/failureMessage';

/**
 * The phone half of the login panel.
 *
 * Lives outside the panel for two reasons. It kept the panel's own branching
 * near where it started, and nothing could reach this logic from a test while
 * it sat inside a 450-line component.
 *
 * Reads the shared store directly rather than taking the fields as arguments.
 * The store is a module singleton, and threading eight values through would
 * only move the coupling into a parameter list.
 *
 * @param onSignedIn - Called once a session exists. The panel decides where a
 *   person lands, because the email flow lands them in the same place.
 */
export const usePhoneLoginFlow = ({
  onSignedIn,
}: {
  onSignedIn: () => void;
}) => {
  const t = useTranslations();
  const { phone, phoneCodeSent, setPhoneCodeSent, token, setToken } =
    useAuthPanelStore();
  const phoneLogin = usePhoneLogin();

  // Only the error stays local. It describes the last attempt, and a stale one
  // after a reload would explain a failure the visitor never saw.
  const [error, setError] = useState<string | undefined>(undefined);

  // People type `(415) 555-0132`. Validate and send what they meant.
  const normalized = normalizePhoneNumber(phone);
  const isValid = phoneNumberSchema.safeParse(normalized).success;
  const isLoading = phoneLogin.isSending || phoneLogin.isVerifying;

  const requestCode = useCallback(async () => {
    // The submit button is disabled for a number that does not parse, but a
    // form submit — Enter in the field — reaches here anyway. GoTrue answers
    // 422, which reads as `unavailable`, so a typo would tell someone the
    // feature is down and log their mistake as an error. Do what the disabled
    // button does.
    if (!isValid) {
      return;
    }

    setError(undefined);
    const result = await phoneLogin.requestCode(normalized);
    if (result.ok) {
      setPhoneCodeSent(true);
      return;
    }
    setError(codeFailureMessage(result.reason, t));
  }, [isValid, normalized, phoneLogin, setPhoneCodeSent, t]);

  /**
   * Asks for another code.
   *
   * Twilio returns the same code while the current one is still valid, and a
   * new one once it expired. The label says "again" rather than "new" so it is
   * true in both cases.
   */
  const resend = useCallback(async () => {
    setToken(undefined);
    setError(undefined);
    await requestCode();
  }, [requestCode, setToken]);

  /** Returns to the number field, so a wrong number is correctable. */
  const changeNumber = useCallback(() => {
    setPhoneCodeSent(false);
    setToken(undefined);
    setError(undefined);
  }, [setPhoneCodeSent, setToken]);

  const submitCode = useCallback(async () => {
    setError(undefined);
    const result = await phoneLogin.verifyCode({
      phone: normalized,
      code: token ?? '',
    });
    if (result.ok) {
      onSignedIn();
      return;
    }
    setError(codeFailureMessage(result.reason, t));
  }, [normalized, token, phoneLogin, onSignedIn, t]);

  return {
    error,
    isValid,
    isLoading,
    isSending: phoneLogin.isSending,
    isVerifying: phoneLogin.isVerifying,
    codeSent: phoneCodeSent,
    normalized,
    requestCode,
    resend,
    changeNumber,
    submitCode,
  };
};
