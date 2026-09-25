import { z } from 'zod';

import { ValidationError } from '../../utils/error';
import type { GoTruePhoneFormat, PhoneNumber } from './types';

/**
 * Validates E.164: a leading `+`, a non-zero country digit, then up to 14 more
 * digits.
 *
 * Use this to validate a phone number inside another schema, such as a tRPC
 * input. Use {@link parsePhoneNumber} when you need a {@link PhoneNumber} to
 * pass to a provider.
 *
 * The CR and LF rejection is not redundant with the pattern. It states the
 * security property outright, the way `safeEmailSchema` does in
 * `services/emails/index.tsx`. A newline that reaches a vendor's HTTP client is
 * a header-injection vector, so this rejects it by name rather than as a side
 * effect of the character class.
 *
 * @see {@link https://www.twilio.com/docs/glossary/what-e164}
 */
export const phoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format, e.g. +15005550006',
  })
  .refine((value) => !/[\r\n]/.test(value), {
    message: 'Phone number must not contain CR or LF characters',
  });

/** A {@link safeParsePhoneNumber} outcome: a branded number, or the reason it was rejected. */
export type PhoneNumberParseResult =
  | { success: true; data: PhoneNumber }
  | { success: false; error: ValidationError };

/**
 * Validates a caller-supplied string and brands it as a {@link PhoneNumber},
 * reporting failure as a return value rather than an exception.
 *
 * Prefer this over {@link parsePhoneNumber} at a boundary that already reports
 * its own outcome by returning, such as an Inngest step or a queue handler —
 * a malformed number then reads as one more case to branch on, not a
 * try/catch wrapped around validation.
 *
 * This is the only way to produce a {@link PhoneNumber} on the success path,
 * so no unchecked string reaches a vendor.
 *
 * @param value - The number to validate, in E.164 format.
 * @returns `{ success: true, data }` with the branded number, or
 *   `{ success: false, error }` naming the `phone` field.
 *
 * @example
 * ```ts
 * const parsed = safeParsePhoneNumber(from);
 * if (!parsed.success) {
 *   return { message: 'invalid phone number' };
 * }
 * await provider.sendSms({ to: parsed.data, body });
 * ```
 */
export const safeParsePhoneNumber = (value: string): PhoneNumberParseResult => {
  const parsed = phoneNumberSchema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid phone number';
    return {
      success: false,
      error: new ValidationError(message, { phone: message }),
    };
  }
  return { success: true, data: parsed.data as PhoneNumber };
};

/**
 * The throwing counterpart of {@link safeParsePhoneNumber}.
 *
 * Call this at a boundary that already uses exceptions for validation
 * failure, such as a tRPC procedure. This is the only way to produce a
 * {@link PhoneNumber} on that path, so no unchecked string reaches a vendor.
 *
 * @param value - The number to validate, in E.164 format.
 * @returns The same string, branded so a provider will accept it.
 * @throws {ValidationError} When the number is not E.164, or it carries a CR
 *   or LF. The error names the `phone` field, so an API surface can report
 *   which input was wrong instead of leaking a schema dump.
 *
 * @example
 * ```ts
 * const to = parsePhoneNumber(input.phone);
 * await provider.sendSms({ to, body });
 * ```
 */
export const parsePhoneNumber = (value: string): PhoneNumber => {
  const parsed = safeParsePhoneNumber(value);
  if (!parsed.success) {
    throw parsed.error;
  }
  return parsed.data;
};

/**
 * Turns a number as a person types it into E.164.
 *
 * People type `(415) 555-0132`, not `+14155550132`. This strips the formatting
 * and adds a country code when the input leaves no doubt, so a caller can
 * validate what a person meant rather than what they typed.
 *
 * The `1` default is a United States assumption. It applies only to a bare
 * ten-digit number, which is unambiguous in the North American plan. Anything
 * else must carry its own `+` and country code, so no international number is
 * silently rewritten into the wrong country.
 *
 * Returns the input unchanged when it fits no rule. {@link phoneNumberSchema}
 * then rejects it and names the field.
 *
 * @param value - A number as typed.
 * @returns The number in E.164, or the input unchanged.
 *
 * @example
 * ```ts
 * normalizePhoneNumber('(415) 555-0132'); // '+14155550132'
 * normalizePhoneNumber('+44 20 7946 0958'); // '+442079460958'
 * ```
 */
export const normalizePhoneNumber = (value: string): string => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return trimmed;
};

/**
 * Whether what a person typed is, once normalized, a valid E.164 number.
 *
 * `usePhoneLoginFlow` and `JoinAccountModal` each hand-rolled
 * `phoneNumberSchema.safeParse(normalizePhoneNumber(raw)).success` before this
 * existed. Use this instead of a third copy, in a phone field that only needs
 * a submit-enabled boolean; use {@link normalizePhoneNumber} together with
 * {@link safeParsePhoneNumber} when the normalized value is also needed.
 *
 * @param raw - A number as typed.
 * @returns Whether the normalized value passes {@link phoneNumberSchema}.
 */
export const isValidTypedPhoneNumber = (raw: string): boolean =>
  phoneNumberSchema.safeParse(normalizePhoneNumber(raw)).success;

/**
 * Turns an E.164 number into the format GoTrue stores on `auth.users.phone`:
 * the same digits, with the leading `+` dropped.
 *
 * Three call sites re-derived this independently before this existed —
 * `releaseTestPhoneNumber` and `findAuthUserByPhone` in
 * `tests/core/src/test-data.ts`, and `requestPhoneCode` in
 * `apps/app/src/hooks/useClaimAccount.ts` — each stripping the `+` inline
 * with its own copy of the same comment. Use this instead of a fourth copy,
 * and instead of comparing a raw `+`-prefixed value against `authUsers.phone`
 * directly, which never matches.
 *
 * @param phone - A number in E.164 form, branded or not.
 * @returns The digits GoTrue stores: the same number, without the `+`.
 *
 * @example
 * ```ts
 * const known = await db
 *   .select()
 *   .from(authUsers)
 *   .where(eq(authUsers.phone, toGoTruePhoneFormat(to)));
 * ```
 */
export const toGoTruePhoneFormat = (
  phone: PhoneNumber | string,
): GoTruePhoneFormat => phone.replace(/^\+/, '') as GoTruePhoneFormat;
