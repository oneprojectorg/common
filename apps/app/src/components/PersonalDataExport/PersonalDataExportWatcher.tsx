'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { EXPORT_WAIT_TIMEOUT_MS } from '@/components/exports/exportWait';

import {
  PERSONAL_DATA_EXPORT_MAX_WAIT_MS,
  usePersonalDataExportStore,
} from './personalDataExportStore';
import { useDownloadPersonalDataExport } from './useDownloadPersonalDataExport';

/**
 * Follows a running personal data export to its end, wherever the user is.
 *
 * Mounted once in the locale layout, because every page header has its own
 * avatar menu and the settings modal unmounts on close. Renders nothing.
 *
 * The finished file is offered, not downloaded: a save dialog firing minutes
 * later, mid-task, is easy to miss. The offer stays until it is dismissed, and
 * the settings row keeps it after that.
 *
 * It reads the status with `useQuery` rather than a suspense query on purpose.
 * Nothing renders from the result, and a failed read must not end the run,
 * which an error boundary would.
 */
export const PersonalDataExportWatcher = () => {
  const state = usePersonalDataExportStore((store) => store.state);

  if (state.phase !== 'running') {
    return null;
  }

  return (
    <RunningExport
      key={state.exportId}
      exportId={state.exportId}
      startedAt={state.startedAt}
    />
  );
};

const RunningExport = ({
  exportId,
  startedAt,
}: {
  exportId: string;
  startedAt: number;
}) => {
  const t = useTranslations('settings');
  const complete = usePersonalDataExportStore((store) => store.complete);
  const reset = usePersonalDataExportStore((store) => store.reset);
  const download = useDownloadPersonalDataExport();
  // bumped to re-arm the silence timer when a re-read finds the run unchanged
  const [silentPeriods, setSilentPeriods] = useState(0);

  const { data: status, refetch } =
    trpc.account.getPersonalDataExportStatus.useQuery(
      { exportId },
      { retry: 2 },
    );

  const reportedStatus = status?.status;

  // Settles on an answer from the server. A failed read is not an answer: the
  // run may be fine, so the silence timer below retries it.
  useEffect(() => {
    // The record is written before the run is queued, so its absence means it
    // aged out or was never stored.
    if (status?.status === 'failed' || status?.status === 'not_found') {
      if (reset(exportId)) {
        logger.error('Personal data export failed', {
          exportId,
          status: status.status,
        });
        toast.error(t('downloadDataFailed'));
      }
      return;
    }

    if (status?.status !== 'completed') {
      return;
    }

    const isPartial = Boolean(status.truncatedSections?.length);

    // the store refuses a second settle, so a repeat read reports nothing
    if (!complete(exportId, { isPartial })) {
      return;
    }

    toast.success(t('downloadDataReady'), {
      description: isPartial ? t('downloadDataPartial') : undefined,
      // the run may have taken many minutes; keep the offer until dismissed
      duration: 0,
      action: {
        label: t('downloadFileAction'),
        onClick: () => void download(exportId),
      },
    });
  }, [status, exportId, complete, reset, download, t]);

  // A broadcast can be lost and a read can fail, so silence triggers a re-read.
  // A run that is merely slow keeps waiting, up to the cap.
  useEffect(() => {
    if (
      reportedStatus === 'completed' ||
      reportedStatus === 'failed' ||
      reportedStatus === 'not_found'
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await refetch();

      // a new status re-runs both effects, which handle it
      if (cancelled || (data && data.status !== reportedStatus)) {
        return;
      }

      if (Date.now() - startedAt >= PERSONAL_DATA_EXPORT_MAX_WAIT_MS) {
        if (reset(exportId)) {
          logger.error('Personal data export timed out', {
            exportId,
            status: reportedStatus ?? 'unread',
          });
          toast.error(t('downloadDataFailed'));
        }
        return;
      }

      setSilentPeriods((count) => count + 1);
    }, EXPORT_WAIT_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [exportId, startedAt, reportedStatus, silentPeriods, refetch, reset, t]);

  return null;
};
