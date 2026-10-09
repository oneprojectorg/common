import type { PhoneNumber, SmsProvider, SmsSendResult } from '@op/common';

export interface RecordedSms {
  to: PhoneNumber;
  body: string;
  providerMessageId: string;
}

const sent: RecordedSms[] = [];

export const recordedSms: ReadonlyArray<RecordedSms> = sent;

export const resetRecordedSms = (): void => {
  sent.length = 0;
};

export const recordingSmsProvider: SmsProvider = {
  sendSms: async ({ to, body }): Promise<SmsSendResult> => {
    const providerMessageId = `recorded-${sent.length + 1}`;
    sent.push({ to, body, providerMessageId });
    return { status: 'accepted', providerMessageId };
  },
};

export const smsProviderMock = () => ({
  getSmsProvider: (): SmsProvider => recordingSmsProvider,
});
