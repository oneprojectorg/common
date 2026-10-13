export const SMS_KEYWORDS = [
  'join',
  'yes',
  'vote',
  'list',
  'show',
  'decisions',
  'proposals',
  'info',
  'more',
  'done',
  'submit',
  'remove',
] as const;

export type SmsKeyword = (typeof SMS_KEYWORDS)[number];
