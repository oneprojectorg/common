import { Events } from '@op/events';
import { describe, expect, it } from 'vitest';

describe('sms/inbound.received event schema', () => {
  it('given an event recorded before the argument field existed, when parsed, then it reads as no argument', () => {
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
      to: null,
    });
  });

  it('given an event recorded before the to field existed, when parsed, then it reads as sent to no known line', () => {
    const parsed = Events.smsInboundReceived.schema.parse({
      from: '+15005550006',
      messageSid: 'SM-no-to',
      code: null,
      keyword: 'show',
      argument: 'columbus',
    });

    expect(parsed.to).toBeNull();
  });
});
