import type { PhoneNumber, SmsProvider, SmsSendResult } from '@op/common';

export interface RecordedSms {
  to: PhoneNumber;
  from: PhoneNumber | null;
  body: string;
  providerMessageId: string;
}

type SmsRefusal = Extract<SmsSendResult, { status: 'rejected' }>;

const sent: RecordedSms[] = [];

const refusals = new Map<PhoneNumber, SmsRefusal>();

export const recordedSms: ReadonlyArray<RecordedSms> = sent;

export const resetRecordedSms = (): void => {
  sent.length = 0;
  refusals.clear();
};

export const refuseSmsTo = (
  to: PhoneNumber,
  refusal: Omit<SmsRefusal, 'status'>,
): void => {
  refusals.set(to, { status: 'rejected', ...refusal });
};

export const recordingSmsProvider: SmsProvider = {
  sendSms: async ({ to, body, from }): Promise<SmsSendResult> => {
    const refusal = refusals.get(to);
    if (refusal) {
      return refusal;
    }
    const providerMessageId = `recorded-${sent.length + 1}`;
    sent.push({ to, from: from ?? null, body, providerMessageId });
    return { status: 'accepted', providerMessageId };
  },
};

export const smsProviderMock = () => ({
  getSmsProvider: (): SmsProvider => recordingSmsProvider,
});
