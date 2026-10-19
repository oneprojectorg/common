import {
  SMS_CARRIER_KEYWORD_TYPES,
  SMS_CARRIER_KEYWORDS,
  type SmsCarrierKeyword,
} from '@op/core/sms';

import { trimTrailing } from './text';

const CARRIER_TERMINATORS = new Set(['.', '!', '?']);

export const parseCarrierKeyword = (body: string): SmsCarrierKeyword | null => {
  const word = trimTrailing(body.trim(), CARRIER_TERMINATORS).toLowerCase();
  return (
    SMS_CARRIER_KEYWORD_TYPES.find((type) =>
      SMS_CARRIER_KEYWORDS[type].includes(word),
    ) ?? null
  );
};

export const isCarrierKeyword = (
  value: string | null | undefined,
): value is SmsCarrierKeyword =>
  SMS_CARRIER_KEYWORD_TYPES.some((type) => type === value);
