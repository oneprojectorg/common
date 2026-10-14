import { set } from '@op/cache';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import { assertUserByAuthId } from '../assert';
import { EXPORT_CACHE_TTL_SECONDS } from '../exports';
import { personalDataExportCacheKey } from './constants';

export const requestPersonalDataExport = async ({
  user,
}: {
  user: User;
}): Promise<{ exportId: string }> => {
  await assertUserByAuthId(user.id);

  const exportId = randomUUID();

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
