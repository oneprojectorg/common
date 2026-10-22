import {
  SMS_ARGUMENT_KEYWORDS,
  SMS_BARE_KEYWORDS,
  type SmsKeyword,
} from '@op/core/sms';

import { trimTrailing } from './text';

export interface SmsCommand {
  keyword: SmsKeyword | null;
  argument: string | null;
}

const bareKeywordPattern = (keyword: string) =>
  new RegExp(`^${keyword}[.!]?$`, 'i');

const argumentKeywordPattern = (keyword: string) =>
  new RegExp(`^${keyword}(?=[.!:,\\s]|$)`, 'i');

const ARGUMENT_SEPARATOR_PATTERN = /^[.!:,]/;
const ARGUMENT_TERMINATORS = new Set(['.', '!']);

const noCommand: SmsCommand = { keyword: null, argument: null };

export const parseSmsCommand = (body: string): SmsCommand => {
  const text = body.trim();
  const bare = SMS_BARE_KEYWORDS.find((keyword) =>
    bareKeywordPattern(keyword).test(text),
  );
  if (bare) {
    return { keyword: bare, argument: null };
  }
  const withArgument = SMS_ARGUMENT_KEYWORDS.find((keyword) =>
    argumentKeywordPattern(keyword).test(text),
  );
  if (withArgument) {
    const rest = text
      .slice(withArgument.length)
      .replace(ARGUMENT_SEPARATOR_PATTERN, '');
    const argument = trimTrailing(rest, ARGUMENT_TERMINATORS)
      .trim()
      .toLowerCase();
    return {
      keyword: withArgument,
      argument: argument.length > 0 ? argument : null,
    };
  }
  return noCommand;
};
