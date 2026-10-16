export const SMS_BARE_KEYWORDS = ['join'] as const;

export const SMS_ARGUMENT_KEYWORDS = ['info'] as const;

export const SMS_KEYWORDS = [
  ...SMS_BARE_KEYWORDS,
  ...SMS_ARGUMENT_KEYWORDS,
] as const;

export type SmsBareKeyword = (typeof SMS_BARE_KEYWORDS)[number];
export type SmsArgumentKeyword = (typeof SMS_ARGUMENT_KEYWORDS)[number];
export type SmsKeyword = (typeof SMS_KEYWORDS)[number];
