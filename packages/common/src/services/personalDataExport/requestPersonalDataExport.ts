import { getWithStatus, setIfAbsentWithStatus } from '@op/cache';
import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import { CommonError, ConflictError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { seedExportRecord } from '../exports';
import {
  PERSONAL_DATA_EXPORT_MAX_RUN_MS,
  personalDataExportActiveKey,
  personalDataExportCacheKey,
} from './constants';
import { releaseActivePersonalDataExport } from './releaseActivePersonalDataExport';

/** Starts an export, or returns the user's export that is running or still downloadable. */
export const requestPersonalDataExport = async ({
  user,
}: {
  user: User;
}): Promise<{ exportId: string }> => {
  await assertUserByAuthId(user.id);

  const exportId = randomUUID();

  // Seeded before the claim, so a caller handed this id can always read it.
  await seedExportRecord(personalDataExportCacheKey(exportId), {
    exportId,
    userId: user.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  const activeExportId = await claimActiveExport({
    userId: user.id,
    exportId,
  });

  if (activeExportId !== exportId) {
    return { exportId: activeExportId };
  }

  try {
    await event.send({
      name: Events.personalDataExportRequested.name,
      data: {
        exportId,
        userId: user.id,
      },
    });
  } catch (error) {
    // No run will release the claim, so release it here.
    await releaseUnusedClaim({ userId: user.id, exportId });
    throw error;
  }

  return { exportId };
};

// Returns `exportId` when this request won the claim, else the held export's id.
const claimActiveExport = async ({
  userId,
  exportId,
}: {
  userId: string;
  exportId: string;
}): Promise<string> => {
  const key = personalDataExportActiveKey(userId);

  const claim = await setIfAbsentWithStatus({
    key,
    data: exportId,
    ttlSeconds: PERSONAL_DATA_EXPORT_MAX_RUN_MS / 1000,
  });

  // `disabled` is a deployment without Redis; the workflow singleton still holds.
  if (claim.status === 'ok' || claim.status === 'disabled') {
    return exportId;
  }

  if (claim.status !== 'exists') {
    // The write can land after its reply timed out, so undo it if it did.
    await releaseUnusedClaim({ userId, exportId });
    throw new CommonError('Could not record the export request.');
  }

  const holder = await getWithStatus(key);

  if (holder.status === 'timeout' || holder.status === 'error') {
    throw new CommonError('Could not read the running export.');
  }

  if (holder.status === 'hit' && typeof holder.data === 'string') {
    return holder.data;
  }

  // The held export released its claim between the two reads.
  throw new ConflictError('An export just finished. Try again.');
};

// Logs a failed release, so the caller's own error is the one that surfaces.
const releaseUnusedClaim = async ({
  userId,
  exportId,
}: {
  userId: string;
  exportId: string;
}): Promise<void> => {
  try {
    await releaseActivePersonalDataExport({ userId, exportId });
  } catch (error) {
    logger.error('Could not release the export claim', { exportId, error });
  }
};
