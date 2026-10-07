import type { PhoneNumber } from '../schemas';
import type { SmsProvider, SmsSendResult } from '../types';

/** One message handed to the in-memory provider. */
export interface RecordedSms {
  to: PhoneNumber;
  body: string;
  providerMessageId: string;
}

/**
 * An {@link SmsProvider} that keeps every message in memory and delivers none.
 *
 * `getSmsProvider` returns it when `SMS_PROVIDER=memory`, so an integration
 * test can drive a real workflow through a real database and then read what
 * it would have texted, with no Twilio account and no network.
 */
export interface MemorySmsProvider extends SmsProvider {
  sendSms(input: { to: PhoneNumber; body: string }): Promise<SmsSendResult>;
  /** Every message accepted since the last {@link reset}, oldest first. */
  readonly sent: ReadonlyArray<RecordedSms>;
  /** Forgets every recorded message. Call it before each test. */
  reset(): void;
}

export const createMemorySmsProvider = (): MemorySmsProvider => {
  const sent: RecordedSms[] = [];

  return {
    sent,
    reset: () => {
      sent.length = 0;
    },
    sendSms: async ({ to, body }) => {
      const providerMessageId = `memory-${sent.length + 1}`;
      sent.push({ to, body, providerMessageId });
      return { status: 'accepted', providerMessageId };
    },
  };
};

/** The one instance `getSmsProvider` hands out, so a test reads what the code under test sent. */
export const memorySmsProvider = createMemorySmsProvider();
