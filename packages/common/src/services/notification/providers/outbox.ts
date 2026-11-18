import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

import type { SmsProvider } from '../types';

/**
 * A development stand-in for the Twilio provider. Instead of calling a
 * vendor, `sendSms` appends each message as one JSON line to the file at
 * `path`, so a local client can tail the file and show the conversation.
 * Every send is accepted; rejection and retry paths stay with the real
 * provider. `getSmsProvider` returns this when `TWILIO_FAKE_SMS_OUTBOX` is
 * set, and refuses it in production.
 */
export const createOutboxProvider = (path: string): SmsProvider => ({
  async sendSms({ to, body, from }) {
    const providerMessageId = `fake-${randomUUID()}`;
    const line = JSON.stringify({
      at: new Date().toISOString(),
      to,
      from: from ?? null,
      body,
      providerMessageId,
    });
    await appendFile(path, `${line}\n`);
    return { status: 'accepted', providerMessageId };
  },
});
