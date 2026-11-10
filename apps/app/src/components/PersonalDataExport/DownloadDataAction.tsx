'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuDownload, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { usePersonalDataExportStore } from './personalDataExportStore';
import { useDownloadPersonalDataExport } from './useDownloadPersonalDataExport';

/**
 * The control for the settings "Download your data" row: starts an export,
 * shows it running, then offers the file.
 *
 * The run itself is followed by {@link PersonalDataExportWatcher}, so closing
 * the modal or leaving the page does not lose it.
 */
export const DownloadDataAction = () => {
  const t = useTranslations('settings');
  const state = usePersonalDataExportStore((store) => store.state);
  const begin = usePersonalDataExportStore((store) => store.begin);
  const start = usePersonalDataExportStore((store) => store.start);
  const abort = usePersonalDataExportStore((store) => store.abort);

  // The callbacks live on the mutation, not on `mutate`, so they still run when
  // the modal closes before the request returns.
  const startExport = trpc.account.exportPersonalData.useMutation({
    onSuccess: ({ exportId }) => start(exportId),
    onError: (error) => {
      abort();
      logger.error('Failed to start personal data export', { error });
      const isRateLimited =
        error.data != null &&
        'httpStatus' in error.data &&
        error.data.httpStatus === 429;
      toast.error(
        isRateLimited ? t('downloadDataRateLimited') : t('downloadDataFailed'),
      );
    },
  });

  const isRunning = state.phase === 'starting' || state.phase === 'running';

  return (
    // the label is the status, so a change to it is announced
    <div aria-live="polite">
      {state.phase === 'ready' ? (
        <DownloadFileButton exportId={state.exportId} />
      ) : (
        <Button
          variant="outline"
          // disabled rather than `loading`, whose spinner hides the label; kept
          // focusable so a keyboard user does not lose their place
          disabled={isRunning}
          focusableWhenDisabled
          aria-busy={isRunning}
          onClick={() => {
            if (begin()) {
              startExport.mutate(undefined);
            }
          }}
        >
          {isRunning ? t('downloadDataPreparing') : t('downloadAction')}
        </Button>
      )}
    </div>
  );
};

/**
 * Warning under the row when the file left sections out. The toast says so too,
 * but it is gone by the time the user opens the file.
 */
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
