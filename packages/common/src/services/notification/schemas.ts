import { z } from 'zod';

import { ValidationError } from '../../utils/error';

export const phoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format, e.g. +15005550006',
  })
  .refine((value) => !/[\r\n]/.test(value), {
    message: 'Phone number must not contain CR or LF characters',
  })
  .brand<'PhoneNumber'>();

export type PhoneNumber = z.infer<typeof phoneNumberSchema>;

export type PhoneNumberParseResult =
  | { success: true; data: PhoneNumber }
  | { success: false; error: ValidationError };

export const safeParsePhoneNumber = (value: string): PhoneNumberParseResult => {
  const parsed = phoneNumberSchema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid phone number';
    return {
      success: false,
      error: new ValidationError(message, { phone: message }),
    };
  }
  return { success: true, data: parsed.data };
};

export const parsePhoneNumber = (value: string): PhoneNumber => {
  const parsed = safeParsePhoneNumber(value);
  if (!parsed.success) {
    throw parsed.error;
  }
  return parsed.data;
};

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

export const isValidTypedPhoneNumber = (raw: string): boolean =>
  phoneNumberSchema.safeParse(normalizePhoneNumber(raw)).success;

const goTruePhoneSchema = phoneNumberSchema
  .transform((phone) => phone.replace(/^\+/, ''))
  .brand<'GoTruePhoneFormat'>();

export type GoTruePhoneFormat = z.infer<typeof goTruePhoneSchema>;

export const toGoTruePhoneFormat = (phone: PhoneNumber): GoTruePhoneFormat =>
  goTruePhoneSchema.parse(phone);

const SMS_CODE_PATTERN = /^\d{4,10}$/;

export const extractSmsCode = (body: string): string | null => {
  const compact = body.replace(/\s+/g, '');
  return SMS_CODE_PATTERN.test(compact) ? compact : null;
};

export type SmsKeyword =
  | 'join'
  | 'yes'
  | 'vote'
  | 'list'
  | 'show'
  | 'decisions'
  | 'proposals'
  | 'info'
  | 'more'
  | 'done'
  | 'submit'
  | 'remove';

export interface SmsCommand {
  keyword: SmsKeyword | null;
  argument: string | null;
  codes: string[];
}

const BARE_KEYWORDS: ReadonlyArray<SmsKeyword> = [
  'join',
  'yes',
  'list',
  'decisions',
  'more',
  'done',
  'submit',
];

const ARGUMENT_KEYWORDS: ReadonlyArray<SmsKeyword> = [
  'vote',
  'show',
  'proposals',
  'info',
  'remove',
];

const bareKeywordPattern = (keyword: string) =>
  new RegExp(`^${keyword}[.!]?$`, 'i');

const argumentKeywordPattern = (keyword: string) =>
  new RegExp(`^${keyword}(?=[.!:,\\s]|$)`, 'i');

const ARGUMENT_SEPARATOR_PATTERN = /^[.!:,]/;
const PICK_CODES_PATTERN = /^\d{3}(?:[\s,]+\d{3})*[.!]?$/;
const CODE_PATTERN = /\d{3}/g;

const noCommand: SmsCommand = { keyword: null, argument: null, codes: [] };

export const parseSmsCommand = (body: string): SmsCommand => {
  const text = body.trim();
  const bare = BARE_KEYWORDS.find((keyword) =>
    bareKeywordPattern(keyword).test(text),
  );
  if (bare) {
    return { keyword: bare, argument: null, codes: [] };
  }
  const withArgument = ARGUMENT_KEYWORDS.find((keyword) =>
    argumentKeywordPattern(keyword).test(text),
  );
  if (withArgument) {
    const argument = text
      .slice(withArgument.length)
      .replace(ARGUMENT_SEPARATOR_PATTERN, '')
      .trim()
      .toLowerCase();
    return {
      keyword: withArgument,
      argument: argument.length > 0 ? argument : null,
      codes: [],
    };
  }
  if (PICK_CODES_PATTERN.test(text)) {
    return {
      keyword: null,
      argument: null,
      codes: text.match(CODE_PATTERN) ?? [],
    };
  }
  return noCommand;
};
