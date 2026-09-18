import { set } from '@op/cache';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import { assertUserByAuthId } from '../assert';
import { EXPORT_CACHE_TTL_SECONDS } from '../exports';
import { personalDataExportCacheKey } from './constants';

/**
 * Queue a personal data export for the calling subject. Takes no id, so there is
 * no parameter through which one account could ask for another's data.
 *
 * The account lookup is not a permission check: it fails a missing account here,
 * where the caller sees it, rather than inside a job whose only report is a
 * failed export record.
 */
export const requestPersonalDataExport = async ({
  user,
}: {
  user: User;
}): Promise<{ exportId: string }> => {
  await assertUserByAuthId(user.id);

  const exportId = randomUUID();

  // Seeded in full: `userId` is what the first status read checks ownership
  // against, and this cache is the only store that could supply it.
  await set(
    personalDataExportCacheKey(exportId),
    {
      exportId,
      userId: user.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    EXPORT_CACHE_TTL_SECONDS,
  );

  await event.send({
    name: Events.personalDataExportRequested.name,
    data: {
      exportId,
      userId: user.id,
    },
  });

  return { exportId };
};
