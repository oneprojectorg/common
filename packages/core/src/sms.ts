export const SMS_BARE_KEYWORDS = [
  'join',
  'agree',
  'more',
  'list',
  'done',
  'submit',
] as const;

export const SMS_ARGUMENT_KEYWORDS = [
  'show',
  'vote',
  'proposals',
  'info',
  'remove',
  'move',
] as const;

export const SMS_KEYWORDS = [
  ...SMS_BARE_KEYWORDS,
  ...SMS_ARGUMENT_KEYWORDS,
] as const;

export type SmsKeyword = (typeof SMS_KEYWORDS)[number];

export const SMS_CARRIER_KEYWORD_TYPES = ['STOP', 'START', 'HELP'] as const;

export type SmsCarrierKeyword = (typeof SMS_CARRIER_KEYWORD_TYPES)[number];

export const SMS_CARRIER_KEYWORDS: Record<
  SmsCarrierKeyword,
  ReadonlyArray<string>
> = {
  STOP: [
    'stop',
    'stopall',
    'unsubscribe',
    'cancel',
    'end',
    'quit',
    'revoke',
    'optout',
  ],
  START: ['start', 'unstop'],
  HELP: ['help'],
};
