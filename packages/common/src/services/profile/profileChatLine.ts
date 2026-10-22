import { db, eq, sql } from '@op/db/client';
import { profileChatLines, profiles } from '@op/db/schema';
import { logger } from '@op/logging';

import { ConflictError, NotFoundError } from '../../utils';
import {
  normalizePhoneNumber,
  parsePhoneNumber,
} from '../notification/schemas';

export interface ProfileChatLine {
  phoneNumber: string;
}

export const getProfileChatLine = async ({
  profileId,
}: {
  profileId: string;
}): Promise<ProfileChatLine | null> => {
  const line = await db.query.profileChatLines.findFirst({
    where: { profileId },
    columns: { phoneNumber: true },
  });

  return line ?? null;
};

export const setProfileChatLine = async ({
  profileId,
  phoneNumber,
}: {
  profileId: string;
  phoneNumber: string;
}): Promise<ProfileChatLine> => {
  const phone = parsePhoneNumber(normalizePhoneNumber(phoneNumber));

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .for('update');
    if (!locked) {
      throw new NotFoundError('Profile', profileId);
    }

    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${'profile_chat_lines:' + phone}))`,
    );

    const holder = await tx.query.profileChatLines.findFirst({
      where: { phoneNumber: phone },
      columns: { profileId: true },
    });
    if (holder && holder.profileId !== profileId) {
      throw new ConflictError('This number is bound to another profile');
    }

    await tx
      .insert(profileChatLines)
      .values({ profileId, phoneNumber: phone })
      .onConflictDoUpdate({
        target: profileChatLines.profileId,
        set: { phoneNumber: phone },
      });
  });

  logger.info('Chat line bound', { profileId });

  return { phoneNumber: phone };
};

export const clearProfileChatLine = async ({
  profileId,
}: {
  profileId: string;
}): Promise<{ cleared: boolean }> => {
  const removed = await db
    .delete(profileChatLines)
    .where(eq(profileChatLines.profileId, profileId))
    .returning({ id: profileChatLines.id });

  if (removed.length > 0) {
    logger.info('Chat line cleared', { profileId });
  }

  return { cleared: removed.length > 0 };
};
