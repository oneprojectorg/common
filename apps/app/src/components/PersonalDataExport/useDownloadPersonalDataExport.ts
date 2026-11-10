'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useCallback } from 'react';

import { useTranslations } from '@/lib/i18n';

import { isExportUnreachableError } from './errors';
import {
  PERSONAL_DATA_EXPORT_READY_TOAST_ID,
  usePersonalDataExportStore,
} from './personalDataExportStore';

// Re-reads the record on each click: the server signs a fresh, short-lived URL.
export const useDownloadPersonalDataExport = () => {
  const t = useTranslations('settings');
  const utils = trpc.useUtils();
  const reset = usePersonalDataExportStore((store) => store.reset);

  return useCallback(
    async (exportId: string) => {
      const retire = () => {
        toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
        if (reset(exportId)) {
          toast.error(t('downloadDataFailed'));
        }
      };

      try {
        const record = await utils.account.getPersonalDataExportStatus.fetch(
          { exportId },
          { staleTime: 0 },
        );
        if (record.status === 'completed' && record.signedUrl) {
          window.location.assign(record.signedUrl);
          return;
        }
        if (record.status === 'failed' || record.status === 'not_found') {
          retire();
          return;
        }
      } catch (error) {
        logger.error('Could not read personal data export', { error });
        if (isExportUnreachableError(error)) {
          retire();
          return;
        }
      }

      toast.error(t('downloadDataLinkFailed'));
    },
    [utils, reset, t],
  );
};
