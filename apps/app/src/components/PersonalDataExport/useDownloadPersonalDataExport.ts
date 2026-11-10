'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useCallback } from 'react';

import { useTranslations } from '@/lib/i18n';

import { resolveExportRetryOutcome } from '@/components/exports/exportRetry';

import { usePersonalDataExportStore } from './personalDataExportStore';

/**
 * Returns a function that saves a finished export's file.
 *
 * It re-reads the record on every call instead of keeping the URL from when the
 * run settled. A signed URL lasts 6 hours and the server re-signs a stale one on
 * read, so a fresh read is what keeps a link offered hours ago working.
 *
 * The run stays ready afterwards. Nothing tells the page whether the save
 * dialog was completed, so the user can take the file again.
 */
export const useDownloadPersonalDataExport = () => {
  const t = useTranslations('settings');
  const utils = trpc.useUtils();
  const reset = usePersonalDataExportStore((store) => store.reset);

  return useCallback(
    async (exportId: string) => {
      const { read, errored } = await utils.account.getPersonalDataExportStatus
        .fetch({ exportId }, { staleTime: 0 })
        .then((record) => ({ read: record, errored: false }))
        .catch((error: unknown) => {
          logger.error('Could not read personal data export', { error });
          return { read: undefined, errored: true };
        });

      const signedUrl =
        read?.status === 'completed' ? read.signedUrl : undefined;
      const outcome = resolveExportRetryOutcome({
        errored,
        status: read?.status,
        signedUrl,
      });

      switch (outcome) {
        case 'recovered':
          if (signedUrl) {
            // served as an attachment, so this saves without leaving the page
            window.location.assign(signedUrl);
          }
          return;
        case 'failure-already-reported':
        case 'record-gone':
          // the file is gone; only a new export helps
          reset(exportId);
          toast.error(t('downloadDataFailed'));
          return;
        case 'still-unavailable':
          // the file is most likely still there, so keep the run
          toast.error(t('downloadDataLinkFailed'));
          return;
      }
    },
    [utils, reset, t],
  );
};
