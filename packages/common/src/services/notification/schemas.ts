import { z } from 'zod';

import { ValidationError } from '../../utils/error';
import type { PhoneNumber } from './types';

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

/**
 * Validates a caller-supplied string and brands it as a {@link PhoneNumber}.
 *
 * Call this at the boundary, once, on any number that arrives from a user or a
 * database row. This is the only way to produce a {@link PhoneNumber}, so no
 * unchecked string reaches a vendor.
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
  const parsed = phoneNumberSchema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid phone number';
    throw new ValidationError(message, { phone: message });
  }
  return parsed.data as PhoneNumber;
};

/**
 * Turns a number as a person types it into E.164.
 *
 * People type `(818) 212-4554`, not `+18182124554`. This strips the formatting
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
 * normalizePhoneNumber('(818) 212-4554'); // '+18182124554'
 * normalizePhoneNumber('+44 20 7183 8750'); // '+442071838750'
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
