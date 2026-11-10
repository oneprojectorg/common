'use client';

import { getMutationKey, trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useIsMutating } from '@tanstack/react-query';
import { useState } from 'react';
import { LuDownload, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { getHttpStatus } from './errors';
import { usePersonalDataExportStore } from './personalDataExportStore';
import { useDownloadPersonalDataExport } from './useDownloadPersonalDataExport';

export const DownloadDataAction = () => {
  const t = useTranslations('settings');
  const state = usePersonalDataExportStore((store) => store.state);
  const start = usePersonalDataExportStore((store) => store.start);

  // callbacks on the mutation, not `mutate`, so they run after the modal closes
  const startExport = trpc.account.exportPersonalData.useMutation({
    onSuccess: ({ exportId }) => start(exportId),
    onError: (error) => {
      logger.error('Failed to start personal data export', { error });
      toast.error(
        getHttpStatus(error) === 429
          ? t('downloadDataRateLimited')
          : t('downloadDataFailed'),
      );
    },
  });

  // sees a start sent before the modal was closed and reopened
  const isStarting =
    useIsMutating({
      mutationKey: getMutationKey(trpc.account.exportPersonalData),
    }) > 0;
  const isRunning = isStarting || state.phase === 'running';

  return (
    <div aria-live="polite">
      {state.phase === 'ready' ? (
        <DownloadFileButton exportId={state.exportId} />
      ) : (
        <Button
          variant="outline"
          // not `loading`: its spinner hides the label
          disabled={isRunning}
          focusableWhenDisabled
          aria-busy={isRunning}
          onClick={() => startExport.mutate(undefined)}
        >
          {isRunning ? t('downloadDataPreparing') : t('downloadAction')}
        </Button>
      )}
    </div>
  );
};

export const DownloadDataPartialNotice = () => {
  const t = useTranslations('settings');
  const isPartial = usePersonalDataExportStore(
    (store) => store.state.phase === 'ready' && store.state.isPartial,
  );

  return (
    <div aria-live="polite">
      {isPartial ? (
        <p className="mt-2 flex items-center gap-1 text-label text-warning-muted-foreground">
          <LuTriangleAlert aria-hidden />
          {t('downloadDataPartial')}
        </p>
      ) : null}
    </div>
  );
};

const DownloadFileButton = ({ exportId }: { exportId: string }) => {
  const t = useTranslations('settings');
  const download = useDownloadPersonalDataExport();
  const [isReading, setIsReading] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={isReading}
      focusableWhenDisabled
      aria-busy={isReading}
      onClick={() => {
        setIsReading(true);
        void download(exportId).finally(() => setIsReading(false));
      }}
    >
      <LuDownload aria-hidden />
      {t('downloadFileAction')}
    </Button>
  );
};
