'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { createSBBrowserClient } from '@op/supabase/client';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { EXPORT_WAIT_TIMEOUT_MS } from '@/components/exports/exportWait';

import {
  PERSONAL_DATA_EXPORT_MAX_WAIT_MS,
  PERSONAL_DATA_EXPORT_READY_TOAST_ID,
  PERSONAL_DATA_EXPORT_READY_TTL_MS,
  usePersonalDataExportStore,
} from './personalDataExportStore';
import {
  isExportUnreachableError,
  useDownloadPersonalDataExport,
} from './useDownloadPersonalDataExport';

/**
 * Follows a running personal data export to its end, wherever the user is.
 *
 * Mounted once in the locale layout, because every page header has its own
 * avatar menu and the settings modal unmounts on close. Renders nothing. It
 * also restores the store from session storage, so a run survives a reload.
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
  const isEnabled = useFeatureFlag('download-user-data');
  const state = usePersonalDataExportStore((store) => store.state);

  useEffect(() => {
    void usePersonalDataExportStore.persist.rehydrate();

    // Supabase reports a sign-out to every tab. The run belongs to the user who
    // started it, so it goes with them.
    const {
      data: { subscription },
    } = createSBBrowserClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        usePersonalDataExportStore.getState().clear();
        toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // the flag gates the behaviour, not only the settings row
  if (!isEnabled) {
    return null;
  }

  if (state.phase === 'ready') {
    return (
      <ReadyExport
        key={state.exportId}
        exportId={state.exportId}
        readyAt={state.readyAt}
      />
    );
  }

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

  const {
    data: status,
    error: readError,
    refetch,
  } = trpc.account.getPersonalDataExportStatus.useQuery(
    { exportId },
    {
      // a refused read gives the same answer every time
      retry: (failures, error) =>
        failures < 2 && !isExportUnreachableError(error),
    },
  );

  const reportedStatus = status?.status;
  const isUnreachable = isExportUnreachableError(readError);

  // Settles on an answer from the server. A failed read is usually not one: the
  // run may be fine, so the silence timer below retries it. Only a read refused
  // for good (someone else's run, or a record gone) ends it here.
  useEffect(() => {
    // The record is written before the run is queued, so its absence means it
    // aged out or was never stored.
    if (
      isUnreachable ||
      status?.status === 'failed' ||
      status?.status === 'not_found'
    ) {
      if (reset(exportId)) {
        logger.error('Personal data export failed', {
          exportId,
          status: isUnreachable ? 'unreachable' : status?.status,
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
      id: PERSONAL_DATA_EXPORT_READY_TOAST_ID,
      // the run may have taken many minutes; keep the offer until dismissed
      duration: 0,
      action: {
        label: t('downloadFileAction'),
        onClick: () => {
          // one click, one download; the settings row still offers the file
          toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
          void download(exportId);
        },
      },
    });
  }, [status, isUnreachable, exportId, complete, reset, download, t]);

  // A broadcast can be lost and a read can fail, so silence triggers a re-read.
  // A run that is merely slow keeps waiting, up to the cap. The last period is
  // cut short so the cap holds to within one re-read.
  useEffect(() => {
    if (
      reportedStatus === 'completed' ||
      reportedStatus === 'failed' ||
      reportedStatus === 'not_found'
    ) {
      return;
    }

    const giveUp = (reason: string) => {
      if (reset(exportId)) {
        logger.error('Personal data export abandoned', {
          exportId,
          reason,
          status: reportedStatus ?? 'unread',
        });
        toast.error(t('downloadDataFailed'));
      }
    };

    let cancelled = false;
    const untilCap = startedAt + PERSONAL_DATA_EXPORT_MAX_WAIT_MS - Date.now();
    const timer = setTimeout(
      async () => {
        const { data, error } = await refetch();
        const next = data?.status;

        if (cancelled) {
          return;
        }

        // a settled run is handled by the effect above
        if (next === 'completed' || next === 'failed' || next === 'not_found') {
          return;
        }

        if (error && isExportUnreachableError(error)) {
          giveUp('unreachable');
          return;
        }

        if (Date.now() - startedAt >= PERSONAL_DATA_EXPORT_MAX_WAIT_MS) {
          giveUp('timed out');
          return;
        }

        // a new status re-runs this effect, which re-arms the timer
        if (next === reportedStatus) {
          setSilentPeriods((count) => count + 1);
        }
      },
      Math.max(0, Math.min(EXPORT_WAIT_TIMEOUT_MS, untilCap)),
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [exportId, startedAt, reportedStatus, silentPeriods, refetch, reset, t]);

  return null;
};

// Retires a finished export once its window closes, including one restored
// from storage after the window has already passed.
const ReadyExport = ({
  exportId,
  readyAt,
}: {
  exportId: string;
  readyAt: number;
}) => {
  const reset = usePersonalDataExportStore((store) => store.reset);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (reset(exportId)) {
          toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
        }
      },
      Math.max(0, readyAt + PERSONAL_DATA_EXPORT_READY_TTL_MS - Date.now()),
    );

    return () => clearTimeout(timer);
  }, [exportId, readyAt, reset]);

  return null;
};
