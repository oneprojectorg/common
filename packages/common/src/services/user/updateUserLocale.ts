import { and, db, eq, sql } from '@op/db/client';
import { users } from '@op/db/schema';

import type { SupportedLocale } from '../translation/locales';

/** Stores the locale that auth emails for this account are written in. */
export const updateUserLocale = async ({
  authUserId,
  locale,
}: {
  authUserId: string;
  locale: SupportedLocale;
}): Promise<void> => {
  await db
    .update(users)
    .set({ locale })
    .where(
      and(
        eq(users.authUserId, authUserId),
        sql`${users.locale} IS DISTINCT FROM ${locale}`,
      ),
    );
};
