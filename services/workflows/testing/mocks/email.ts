import type { OPBatchSend } from '@op/emails';

type BatchEmail = Parameters<typeof OPBatchSend>[0][number];

export interface RecordedEmail {
  to: string;
  subject: string;
  idempotencyKeyPrefix: string | undefined;
}

const sent: RecordedEmail[] = [];

export const recordedEmails: ReadonlyArray<RecordedEmail> = sent;

export const resetRecordedEmails = (): void => {
  sent.length = 0;
};

export const recordingBatchSend: typeof OPBatchSend = async (
  emails: BatchEmail[],
  { idempotencyKeyPrefix }: { idempotencyKeyPrefix?: string } = {},
) => {
  emails.forEach((email) => {
    sent.push({ to: email.to, subject: email.subject, idempotencyKeyPrefix });
  });
  return {
    data: emails.map((_, index) => ({ id: `recorded-email-${index + 1}` })),
    errors: [],
  };
};

export const emailMock = async (
  importOriginal: () => Promise<typeof import('@op/emails')>,
) => ({
  ...(await importOriginal()),
  OPBatchSend: recordingBatchSend,
});
