import { Events } from '@op/events';
import { describe, expect, it } from 'vitest';

describe('sms/inbound.received event schema', () => {
  it('given an event recorded before argument and codes existed, when parsed, then it reads as no argument and no codes', () => {
    const parsed = Events.smsInboundReceived.schema.parse({
      from: '+15005550006',
      messageSid: 'SM-old',
      code: null,
      keyword: 'join',
    });

    expect(parsed).toEqual({
      from: '+15005550006',
      messageSid: 'SM-old',
      code: null,
      keyword: 'join',
      argument: null,
      codes: [],
    });
  });
});
