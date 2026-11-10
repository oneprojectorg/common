'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useCallback } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getTrpcHttpStatus } from '@/components/exports/errorStatus';
import { resolveExportRetryOutcome } from '@/components/exports/exportRetry';

import {
  PERSONAL_DATA_EXPORT_READY_TOAST_ID,
  usePersonalDataExportStore,
} from './personalDataExportStore';

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
      // an older run's toast can outlive it; its click must not speak for the
      // current run
      if (!isCurrentReadyExport(exportId)) {
        toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
        return;
      }

      const { read, errored, gone } =
        await utils.account.getPersonalDataExportStatus
          .fetch({ exportId }, { staleTime: 0 })
          .then((record) => ({ read: record, errored: false, gone: false }))
          .catch((error: unknown) => {
            logger.error('Could not read personal data export', { error });
            return {
              read: undefined,
              errored: true,
              gone: isExportUnreachableError(error),
            };
          });

      const signedUrl =
        read?.status === 'completed' ? read.signedUrl : undefined;
      const outcome = gone
        ? 'record-gone'
        : resolveExportRetryOutcome({
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
        case 'run-failed':
        case 'record-gone':
          // the file is gone; only a new export helps, and the offer is void
          toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
          if (reset(exportId)) {
            toast.error(t('downloadDataFailed'));
          }
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

/**
 * Whether a failed status read means this client can never read the record:
 * it belongs to another user (403) or is absent (404). Retrying returns the
 * same answer. A 401 is left out: a session refresh can race a read, and the
 * run is still fine.
 */
export const isExportUnreachableError = (error: unknown) => {
  const status = getTrpcHttpStatus(error);
  return status === 403 || status === 404;
};

const isCurrentReadyExport = (exportId: string) => {
  const { state } = usePersonalDataExportStore.getState();
  return state.phase === 'ready' && state.exportId === exportId;
};
