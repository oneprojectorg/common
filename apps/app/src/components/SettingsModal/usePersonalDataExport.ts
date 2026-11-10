'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { EXPORT_WAIT_TIMEOUT_MS } from '@/components/decisions/exportWait';

export type PersonalDataExport = ReturnType<typeof usePersonalDataExport>;

// `not_found` is not terminal: an early read can land before the record exists,
// so a run that never shows up is left to the silence timeout.
const isSettledStatus = (status: string | undefined) =>
  status === 'completed' || status === 'failed';

// Call from a component that outlives the settings modal: the run's state lives
// here, and unmounting would drop a file that is still being produced.
export const usePersonalDataExport = () => {
  const t = useTranslations('settings');
  const [exportId, setExportId] = useState<string | null>(null);

  const startExport = trpc.account.exportPersonalData.useMutation({
    onSuccess: ({ exportId: id }) => {
      setExportId(id);
    },
    onError: (error) => {
      logger.error('Failed to start personal data export', { error });
      toast.error(t('downloadDataFailed'));
    },
  });

  const {
    data: status,
    isError,
    refetch,
  } = trpc.account.getPersonalDataExportStatus.useQuery(
    { exportId: exportId ?? '' },
    { enabled: Boolean(exportId), retry: 2 },
  );

  const reportedStatus = status?.status;
  const isSettled = isError || isSettledStatus(reportedStatus);

  useEffect(() => {
    if (!isSettled) {
      return;
    }

    if (status?.status === 'completed' && status.signedUrl) {
      // The signed URL is served as an attachment, so this saves the file
      // without leaving the page.
      window.location.assign(status.signedUrl);
      if (status.truncatedSections?.length) {
        toast.warning(t('downloadDataPartial'));
      }
    } else {
      logger.error('Personal data export failed', {
        error: isError ? 'status unreadable' : reportedStatus,
      });
      toast.error(t('downloadDataFailed'));
    }
    setExportId(null);
  }, [status, isSettled, isError, reportedStatus, t]);

  // Bounds silence: a lost broadcast would otherwise leave the button spinning.
  // Re-armed on each reported state, and re-reads once before giving up.
  useEffect(() => {
    if (exportId === null || isSettled) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await refetch();
      // A new state re-arms the timer, and a settled or unreadable result is
      // reported by the effect above; either way this run is not timed out.
      if (
        cancelled ||
        error ||
        data?.status !== reportedStatus ||
        isSettledStatus(data?.status)
      ) {
        return;
      }
      logger.error('Personal data export timed out', { exportId });
      toast.error(t('downloadDataFailed'));
      setExportId(null);
    }, EXPORT_WAIT_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [exportId, reportedStatus, isSettled, refetch, t]);

  return {
    start: () => startExport.mutate(undefined),
    isRunning: startExport.isPending || exportId !== null,
  };
};
