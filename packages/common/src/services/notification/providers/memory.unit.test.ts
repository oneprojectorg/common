import { describe, expect, it } from 'vitest';

import { parsePhoneNumber } from '../schemas';
import { createMemorySmsProvider } from './memory';

const TO = parsePhoneNumber('+15005550006');

describe('createMemorySmsProvider', () => {
  it('given a message, when sent, then it is accepted and recorded in order', async () => {
    const provider = createMemorySmsProvider();

    const first = await provider.sendSms({ to: TO, body: 'one' });
    const second = await provider.sendSms({ to: TO, body: 'two' });

    expect(first).toEqual({
      status: 'accepted',
      providerMessageId: 'memory-1',
    });
    expect(second).toEqual({
      status: 'accepted',
      providerMessageId: 'memory-2',
    });
    expect(provider.sent.map((message) => message.body)).toEqual([
      'one',
      'two',
    ]);
  });

  it('given recorded messages, when reset, then nothing remains', async () => {
    const provider = createMemorySmsProvider();
    await provider.sendSms({ to: TO, body: 'one' });

    provider.reset();

    expect(provider.sent).toEqual([]);
  });
});
