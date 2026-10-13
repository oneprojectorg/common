import type { PhoneNumber, SmsProvider, SmsSendResult } from '@op/common';

export interface RecordedSms {
  to: PhoneNumber;
  body: string;
  providerMessageId: string;
}

const sent: RecordedSms[] = [];
const optedOut = new Set<PhoneNumber>();

export const recordedSms: ReadonlyArray<RecordedSms> = sent;

export const resetRecordedSms = (): void => {
  sent.length = 0;
  optedOut.clear();
};

export const optOutNumber = (to: PhoneNumber): void => {
  optedOut.add(to);
};

export const recordingSmsProvider: SmsProvider = {
  sendSms: async ({ to, body }): Promise<SmsSendResult> => {
    if (optedOut.has(to)) {
      return { status: 'rejected', reason: 'opted_out', retryable: false };
    }
    const providerMessageId = `recorded-${sent.length + 1}`;
    sent.push({ to, body, providerMessageId });
    return { status: 'accepted', providerMessageId };
  },
};

export const smsProviderMock = () => ({
  getSmsProvider: (): SmsProvider => recordingSmsProvider,
});
