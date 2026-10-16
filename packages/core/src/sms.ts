export const SMS_BARE_KEYWORDS = [
  'join',
  'yes',
  'list',
  'decisions',
  'more',
  'done',
  'submit',
] as const;

export const SMS_ARGUMENT_KEYWORDS = [
  'vote',
  'show',
  'proposals',
  'info',
  'remove',
] as const;

export const SMS_KEYWORDS = [
  ...SMS_BARE_KEYWORDS,
  ...SMS_ARGUMENT_KEYWORDS,
] as const;

export type SmsBareKeyword = (typeof SMS_BARE_KEYWORDS)[number];
export type SmsArgumentKeyword = (typeof SMS_ARGUMENT_KEYWORDS)[number];
export type SmsKeyword = (typeof SMS_KEYWORDS)[number];

export const SMS_PROPOSAL_CODE = String.raw`\d{3,10}`;
export const SMS_PROPOSAL_CODE_PATTERN = new RegExp(`^${SMS_PROPOSAL_CODE}$`);
