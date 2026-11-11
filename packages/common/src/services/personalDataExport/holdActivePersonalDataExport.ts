import { expireIfEqualsWithStatus } from '@op/cache';

import { CommonError } from '../../utils';
import {
  PERSONAL_DATA_EXPORT_REUSE_MS,
  personalDataExportActiveKey,
} from './constants';

// Keeps a completed export's claim while its file can still be downloaded. Throws so a step retries.
export const holdActivePersonalDataExport = async ({
  userId,
  exportId,
}: {
  userId: string;
  exportId: string;
}): Promise<void> => {
  const held = await expireIfEqualsWithStatus({
    key: personalDataExportActiveKey(userId),
    data: exportId,
    ttlSeconds: PERSONAL_DATA_EXPORT_REUSE_MS / 1000,
  });

  if (held.status === 'timeout' || held.status === 'error') {
    throw new CommonError('Could not keep the export for reuse.');
  }
};
