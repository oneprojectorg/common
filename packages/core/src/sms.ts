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

export const SMS_PROPOSAL_CODE = String.raw`\d{3,10}`;
export const SMS_PROPOSAL_CODE_PATTERN = new RegExp(`^${SMS_PROPOSAL_CODE}$`);
