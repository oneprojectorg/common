'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EXPORT_WAIT_TIMEOUT_MS } from '@/components/decisions/exportWait';

export type PersonalDataExportNotice =
  | 'started'
  | 'ready'
  | 'startError'
  | 'statusError'
  | 'failed'
  | 'timeout';

export type PersonalDataExportPhase =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ready'; signedUrl: string; fileName?: string; isPartial: boolean }
  // the run succeeded but the server could not sign a URL; re-reading recovers it
  | { kind: 'unsigned' };

/**
 * Drives one personal-data export: start it, follow the run over its realtime
 * channel, and hand back a download link. Export state is cache-only, so the
 * export id is the only handle on a run and every path that clears it is final.
 */
export const usePersonalDataExport = ({
  onNotice,
}: {
  onNotice: (notice: PersonalDataExportNotice) => void;
}) => {
  const [exportId, setExportId] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // notices belong to the run, not to the last-rendered callback
  const onNoticeRef = useRef(onNotice);
  useEffect(() => {
    onNoticeRef.current = onNotice;
  });
  const notify = useCallback(
    (notice: PersonalDataExportNotice) => onNoticeRef.current(notice),
    [],
  );

  const startExport = trpc.account.exportPersonalData.useMutation({
    onSuccess: ({ exportId: id }) => {
      setHasTimedOut(false);
      setExportId(id);
      notify('started');
    },
    onError: (error) => {
      logger.error('Failed to start personal data export', { error });
      notify('startError');
    },
  });

  // No polling: the workflow broadcasts on the export's channel and the
  // subscriber re-reads. Retries absorb a dropped request before it is terminal.
  const {
    data: status,
    isError: isStatusError,
    refetch: refetchStatus,
    isFetching: isFetchingStatus,
  } = trpc.account.getPersonalDataExportStatus.useQuery(
    { exportId: exportId ?? '' },
    { enabled: Boolean(exportId) && !hasTimedOut, retry: 2 },
  );

  const isCompleted = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isRunning =
    exportId !== null && !isCompleted && !isFailed && !hasTimedOut;

  useEffect(() => {
    if (!isFailed) {
      return;
    }
    logger.error('Personal data export failed', { exportId });
    notify('failed');
    setExportId(null);
  }, [isFailed, exportId, notify]);

  useEffect(() => {
    if (!isStatusError || isCompleted) {
      return;
    }
    logger.error('Could not read personal data export status', { exportId });
    notify('statusError');
    setExportId(null);
  }, [isStatusError, isCompleted, exportId, notify]);

  // bounds silence, not duration: restarts whenever the run reports a new state
  const reportedState = status?.status;
  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const timer = setTimeout(() => {
      setHasTimedOut(true);
      setExportId(null);
      notify('timeout');
    }, EXPORT_WAIT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isRunning, reportedState, notify]);

  const hasSignedUrl = isCompleted && Boolean(status.signedUrl);
  useEffect(() => {
    if (hasSignedUrl) {
      notify('ready');
    }
  }, [hasSignedUrl, notify]);

  const retryDownload = async () => {
    const { data, error } = await refetchStatus();
    if (!error && data?.status === 'completed' && data.signedUrl) {
      return;
    }
    notify('statusError');
    if (!error && data?.status === 'not_found') {
      setExportId(null);
    }
  };

  const phase: PersonalDataExportPhase = (() => {
    if (isCompleted && status.signedUrl) {
      return {
        kind: 'ready',
        signedUrl: status.signedUrl,
        fileName: status.fileName,
        isPartial: (status.truncatedSections?.length ?? 0) > 0,
      };
    }
    if (isCompleted) {
      return { kind: 'unsigned' };
    }
    if (isRunning) {
      return { kind: 'running' };
    }
    return { kind: 'idle' };
  })();

  return {
    phase,
    isStarting: startExport.isPending,
    isRetrying: isFetchingStatus,
    start: () => startExport.mutate(undefined),
    retryDownload,
    // each run produces one file; taking it retires the id
    markTaken: () => setExportId(null),
  };
};
