import { db, eq, sql } from '@op/db/client';
import {
  type SmsMessage,
  type SmsMessageDirection,
  type SmsMessageStatus,
  smsMessages,
} from '@op/db/schema';

export interface RecordSmsMessageInput {
  direction: SmsMessageDirection;
  body: string;
  phoneNumberId?: string | null;
  authUserId?: string | null;
  counterpartE164?: string | null;
  providerSid?: string | null;
  segments?: number | null;
  status?: SmsMessageStatus;
}

export async function recordSmsMessage({
  direction,
  body,
  phoneNumberId,
  authUserId,
  counterpartE164,
  providerSid,
  segments,
  status,
}: RecordSmsMessageInput): Promise<SmsMessage> {
  const values = {
    direction,
    body,
    phoneNumberId: phoneNumberId ?? null,
    authUserId: authUserId ?? null,
    counterpartE164: counterpartE164 ?? null,
    providerSid: providerSid ?? null,
    segments: segments ?? null,
    ...(status ? { status } : {}),
  };

  const [inserted] = await db
    .insert(smsMessages)
    .values(values)
    .onConflictDoNothing({
      target: [smsMessages.providerSid],
      where: sql`${smsMessages.providerSid} IS NOT NULL`,
    })
    .returning();

  if (inserted) {
    return inserted;
  }

  if (!providerSid) {
    throw new Error('SMS message insert returned no row');
  }

  const existing = await db.query.smsMessages.findFirst({
    where: { providerSid },
  });
  if (!existing) {
    throw new Error(
      'SMS message insert conflicted but no row carries its provider sid',
    );
  }
  return existing;
}

export async function markSmsMessageStatus({
  id,
  status,
}: {
  id: string;
  status: SmsMessageStatus;
}): Promise<void> {
  await db.update(smsMessages).set({ status }).where(eq(smsMessages.id, id));
}
