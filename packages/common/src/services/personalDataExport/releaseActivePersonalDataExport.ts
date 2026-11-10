import { getWithStatus, setWithStatus } from '@op/cache';

import { CommonError } from '../../utils';
import { personalDataExportActiveKey } from './constants';

// Releases the user's claim only if `exportId` still holds it. Throws so a step retries.
export const releaseActivePersonalDataExport = async ({
  userId,
  exportId,
}: {
  userId: string;
  exportId: string;
}): Promise<void> => {
  const key = personalDataExportActiveKey(userId);
  const holder = await getWithStatus(key);

  if (holder.status === 'timeout' || holder.status === 'error') {
    throw new CommonError('Could not read the active export.');
  }

  if (holder.status !== 'hit' || holder.data !== exportId) {
    return;
  }

  const released = await setWithStatus(key, null);

  if (released.status === 'timeout' || released.status === 'error') {
    throw new CommonError('Could not release the active export.');
  }
};
