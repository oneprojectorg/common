import { deleteIfEqualsWithStatus } from '@op/cache';

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
  const released = await deleteIfEqualsWithStatus({
    key: personalDataExportActiveKey(userId),
    data: exportId,
  });

  if (released.status === 'timeout' || released.status === 'error') {
    throw new CommonError('Could not release the active export.');
  }
};
