import { db } from '@op/db/client';

import { type SupportedLocale, isSupportedLocale } from '../translation/locales';

/** The stored locale for auth emails, if the account has a supported one. */
export const getUserLocale = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<SupportedLocale | undefined> => {
  const user = await db.query.users.findFirst({
    columns: { locale: true },
    where: { authUserId },
  });

  return user?.locale && isSupportedLocale(user.locale)
    ? user.locale
    : undefined;
};
