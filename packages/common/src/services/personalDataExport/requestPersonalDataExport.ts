import { getWithStatus, setWithStatus } from '@op/cache';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import { assertUserByAuthId } from '../assert';
import { EXPORT_CACHE_TTL_SECONDS, seedExportRecord } from '../exports';
import {
  PERSONAL_DATA_EXPORT_MAX_RUN_MS,
  personalDataExportActiveKey,
  personalDataExportCacheKey,
} from './constants';
import { personalDataExportRecordSchema } from './schemas';

/** Starts an export, or returns the user's export that is still running. */
export const requestPersonalDataExport = async ({
  user,
}: {
  user: User;
}): Promise<{ exportId: string }> => {
  await assertUserByAuthId(user.id);

  const running = await findRunningExport(user.id);
  if (running) {
    return { exportId: running };
  }

  const exportId = randomUUID();

  await seedExportRecord(personalDataExportCacheKey(exportId), {
    exportId,
    userId: user.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  // best effort: the workflow's singleton still stops a second run
  await setWithStatus(
    personalDataExportActiveKey(user.id),
    exportId,
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

const findRunningExport = async (userId: string) => {
  const pointer = await getWithStatus(personalDataExportActiveKey(userId));
  if (pointer.status !== 'hit' || typeof pointer.data !== 'string') {
    return undefined;
  }

  const record = await getWithStatus(personalDataExportCacheKey(pointer.data));
  if (record.status !== 'hit') {
    return undefined;
  }

  const parsed = personalDataExportRecordSchema.safeParse(record.data);
  if (!parsed.success) {
    return undefined;
  }

  const { status, createdAt, exportId } = parsed.data;
  const isRunning = status === 'pending' || status === 'processing';
  const isFresh =
    Date.now() - Date.parse(createdAt) < PERSONAL_DATA_EXPORT_MAX_RUN_MS;
  return isRunning && isFresh ? exportId : undefined;
};
