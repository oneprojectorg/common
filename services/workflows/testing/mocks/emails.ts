import type { BatchEmailItem } from '@op/emails';
import { vi } from 'vitest';

export interface RecordedEmail {
  to: string;
  from: string | undefined;
  subject: string;
  /** The rendered body as plain text. */
  text: string;
  idempotencyKeyPrefix: string | undefined;
}

const sent: RecordedEmail[] = [];

export const recordedEmails: ReadonlyArray<RecordedEmail> = sent;

/** Replaces only the Resend transport; the templates still render for real. */
export async function emailsMock() {
  const actual =
    await vi.importActual<typeof import('@op/emails')>('@op/emails');

  return {
    ...actual,
    OPBatchSend: async (
      emails: BatchEmailItem[],
      { idempotencyKeyPrefix }: { idempotencyKeyPrefix?: string } = {},
    ) => {
      const data: Array<{ id: string }> = [];

      for (const email of emails) {
        sent.push({
          to: email.to,
          from: email.from,
          subject: email.subject,
          text: await actual.render(email.component(), { plainText: true }),
          idempotencyKeyPrefix,
        });
        data.push({ id: `recorded-${sent.length}` });
      }

      return { data, errors: [] };
    },
  };
}
