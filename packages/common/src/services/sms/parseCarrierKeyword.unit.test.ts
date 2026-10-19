import { describe, expect, it } from 'vitest';

import { parseCarrierKeyword } from './parseCarrierKeyword';

describe('parseCarrierKeyword', () => {
  it.each([
    'STOP',
    'stop',
    ' Stop ',
    'STOP.',
    'unsubscribe',
    'END',
    'quit',
    'stopall',
    'revoke',
    'optout',
    'cancel',
  ])(
    'given %j, when parsed, then it is the carrier STOP keyword Twilio answers itself',
    (body) => {
      expect(parseCarrierKeyword(body)).toBe('STOP');
    },
  );

  it.each(['START', 'unstop', 'Start!'])(
    'given %j, when parsed, then it is the carrier START keyword',
    (body) => {
      expect(parseCarrierKeyword(body)).toBe('START');
    },
  );

  it.each(['HELP', 'help', 'Help?'])(
    'given %j, when parsed, then it is the carrier HELP keyword',
    (body) => {
      expect(parseCarrierKeyword(body)).toBe('HELP');
    },
  );

  it.each([
    'stop it',
    'helpful',
    'show',
    'join',
    'yes',
    'info',
    '',
    'please stop',
  ])('given %j, when parsed, then it is not a carrier keyword', (body) => {
    expect(parseCarrierKeyword(body)).toBeNull();
  });
});
