import {
  SMS_CARRIER_KEYWORD_TYPES,
  SMS_CARRIER_KEYWORDS,
  type SmsCarrierKeyword,
} from '@op/core/sms';

const TRAILING_PUNCTUATION = /[.!?]+$/;

export const parseCarrierKeyword = (body: string): SmsCarrierKeyword | null => {
  const word = body.trim().replace(TRAILING_PUNCTUATION, '').toLowerCase();
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
