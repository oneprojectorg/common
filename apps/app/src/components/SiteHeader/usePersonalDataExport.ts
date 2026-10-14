'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

/**
 * Starts a personal data export and downloads the file once the run completes.
 * Lives above the avatar menu so the wait survives the menu closing.
 */
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

  const { data: status, isError } =
    trpc.account.getPersonalDataExportStatus.useQuery(
      { exportId: exportId ?? '' },
      { enabled: Boolean(exportId), retry: 2 },
    );

  useEffect(() => {
    const isSettled =
      isError ||
      status?.status === 'completed' ||
      status?.status === 'failed' ||
      status?.status === 'not_found';
    if (!isSettled) {
      return;
    }

    if (status?.status === 'completed' && status.signedUrl) {
      // The signed URL forces an attachment, so this downloads in place.
      window.location.assign(status.signedUrl);
    } else {
      toast.error(t('shell.personalDataExportFailed'));
    }
    setExportId(null);
  }, [status, isError, t]);

  return {
    start: () => startExport.mutate(undefined),
    isRunning: startExport.isPending || exportId !== null,
  };
};
