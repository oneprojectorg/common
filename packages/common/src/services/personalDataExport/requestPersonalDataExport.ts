import { set } from '@op/cache';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import { assertUserByAuthId } from '../assert';
import { EXPORT_CACHE_TTL_SECONDS } from '../exports';
import { personalDataExportCacheKey } from './constants';

/**
 * Queue a personal data export for the calling subject.
 *
 * The subject is the caller, and nothing else. This takes no id, so there is no
 * parameter through which one account could ask for another's data — the whole
 * authorization question is "is there a session", which the procedure settles
 * before this runs.
 *
 * The account lookup is not a permission check. It confirms the auth user has a
 * `users` row before a background job goes looking for one, so a missing account
 * fails here where the caller sees it rather than inside a workflow whose only
 * report is a failed export record.
 *
 * @param user - The authenticated caller, who is the data subject.
 * @returns The id of the queued export. The caller follows it with
 *   `getPersonalDataExportStatus`.
 * @throws NotFoundError when the auth user has no `users` row.
 */
export const requestPersonalDataExport = async ({
  user,
}: {
  user: User;
}): Promise<{ exportId: string }> => {
  await assertUserByAuthId(user.id);

  const exportId = randomUUID();

  // Seeded in full rather than as an id and a state: the status contract
  // requires `userId`, and that field is what the first status read checks
  // ownership against. A partial record fails that read instead of answering it.
  // This cache is the only store of export state — no table stands behind it —
  // so nothing else can supply what the seed omits.
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
