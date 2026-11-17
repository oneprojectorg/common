import { db, eq } from '@op/db/client';
import { authUsers } from '@op/db/schema';
import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';

import { type PhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';

export type PhoneAccountCreation =
  | { status: 'created'; authUserId: string }
  | { status: 'rejected'; reason: 'unknown' };

export const createConfirmedPhoneAccount = async ({
  phone,
}: {
  phone: PhoneNumber;
}): Promise<PhoneAccountCreation> => {
  const supabase = createSBServiceClient();

  const [existing] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)))
    .limit(1);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      { phone_confirm: true },
    );
    if (error || !data.user) {
      logger.warn('GoTrue refused to confirm an existing phone account', {
        code: error?.code,
        status: error?.status,
      });
      return { status: 'rejected', reason: 'unknown' };
    }
    return { status: 'created', authUserId: data.user.id };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    phone,
    phone_confirm: true,
  });

  if (error || !data.user) {
    logger.warn('GoTrue refused to create a confirmed phone account', {
      code: error?.code,
      status: error?.status,
    });
    return { status: 'rejected', reason: 'unknown' };
  }

  return { status: 'created', authUserId: data.user.id };
};
