'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import {
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS,
  PERSONAL_DATA_EXPORT_MAX_RUN_MS,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useEffect } from 'react';

import { useTranslations } from '@/lib/i18n';

import { isExportUnreachableError } from './errors';
import {
  PERSONAL_DATA_EXPORT_READY_TOAST_ID,
  usePersonalDataExportStore,
} from './personalDataExportStore';
import { useDownloadPersonalDataExport } from './useDownloadPersonalDataExport';

// backs up the realtime broadcast, which can be lost
const POLL_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Follows a running export to its end on any page. Uses `useQuery`, not a
 * suspense query, because a failed read must not end the run.
 */
export const PersonalDataExportWatcher = () => {
  const isEnabled = useFeatureFlag('download-user-data');
  const state = usePersonalDataExportStore((store) => store.state);

  useEffect(() => {
    if (isEnabled) {
      void usePersonalDataExportStore.persist.rehydrate();
    }
  }, [isEnabled]);

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

  if (state.phase === 'running') {
    return (
      <RunningExport
        key={state.exportId}
        exportId={state.exportId}
        startedAt={state.startedAt}
      />
    );
  }

  return null;
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

  const {
    data: status,
    error,
    isFetched,
  } = trpc.account.getPersonalDataExportStatus.useQuery(
    { exportId },
    { retry: false, refetchInterval: POLL_INTERVAL_MS },
  );

  const isUnreachable = isExportUnreachableError(error);

  useEffect(() => {
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
    // the server deletes the file on its own clock
    const readyAt = status.completedAt
      ? Date.parse(status.completedAt)
      : Date.now();

    if (!complete(exportId, { isPartial, readyAt })) {
      return;
    }

    toast.success(t('downloadDataReady'), {
      description: isPartial ? t('downloadDataPartial') : undefined,
      id: PERSONAL_DATA_EXPORT_READY_TOAST_ID,
      duration: 0,
      action: {
        label: t('downloadFileAction'),
        onClick: () => {
          toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
          void download(exportId);
        },
      },
    });
  }, [status, isUnreachable, exportId, complete, reset, download, t]);

  const isCompleted = status?.status === 'completed';

  useEffect(() => {
    // A restored run may have finished while the page was closed, so ask first.
    if (!isFetched || isCompleted) {
      return;
    }

    const timer = setTimeout(
      () => {
        if (reset(exportId)) {
          logger.error('Personal data export timed out', { exportId });
          toast.error(t('downloadDataFailed'));
        }
      },
      Math.max(0, startedAt + PERSONAL_DATA_EXPORT_MAX_RUN_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [exportId, startedAt, isFetched, isCompleted, reset, t]);

  return null;
};

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
      Math.max(0, readyAt + PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [exportId, readyAt, reset]);

  return null;
};
