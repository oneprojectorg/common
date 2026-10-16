'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { EXPORT_WAIT_TIMEOUT_MS } from '@/components/decisions/exportWait';

const isSettledStatus = (status: string | undefined) =>
  status === 'completed' || status === 'failed' || status === 'not_found';

export const usePersonalDataExport = () => {
  const t = useTranslations();
  const [exportId, setExportId] = useState<string | null>(null);

  const startExport = trpc.account.exportPersonalData.useMutation({
    onSuccess: ({ exportId: id }) => {
      setExportId(id);
    },
    onError: (error) => {
      logger.error('Failed to start personal data export', { error });
      toast.error(t('shell.personalDataExportFailed'));
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
      window.location.assign(status.signedUrl);
    } else {
      toast.error(t('shell.personalDataExportFailed'));
    }
    setExportId(null);
  }, [status, isSettled, t]);

  // Bounds silence: a lost broadcast would otherwise leave the button spinning.
  // Re-armed on each reported state, and re-reads once before giving up.
  useEffect(() => {
    if (exportId === null || isSettled) {
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await refetch();
      if (isSettledStatus(data?.status)) {
        return;
      }
      logger.error('Personal data export timed out', { exportId });
      toast.error(t('shell.personalDataExportFailed'));
      setExportId(null);
    }, EXPORT_WAIT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [exportId, reportedStatus, isSettled, refetch, t]);

  return {
    start: () => startExport.mutate(undefined),
    isRunning: startExport.isPending || exportId !== null,
  };
};
