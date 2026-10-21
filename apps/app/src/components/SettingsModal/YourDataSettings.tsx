'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import { FieldDescription, FieldTitle } from '@op/sense/Field';
import { Header3 } from '@op/sense/Header';
import { type ReactNode, useCallback, useId, useRef, useState } from 'react';
import { LuDownload, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { type Confirmation, InlineConfirmation } from './InlineConfirmation';
import {
  type PersonalDataExportNotice,
  usePersonalDataExport,
} from './usePersonalDataExport';

export const YourDataSettings = () => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationCount = useRef(0);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const showNotice = useCallback(
    (notice: PersonalDataExportNotice) => {
      confirmationCount.current += 1;
      setConfirmation({
        id: confirmationCount.current,
        ...noticeContent(notice, t),
      });
    },
    [t],
  );
  const exportRun = usePersonalDataExport({ onNotice: showNotice });

  return (
    <div className="flex flex-col gap-4">
      <Header3>{t('yourDataTab')}</Header3>
      <div className="flex flex-col gap-8">
        <DataRow
          title={t('downloadDataTitle')}
          hint={t('downloadDataHint')}
          action={<DownloadDataAction {...exportRun} />}
          footer={
            <>
              <InlineConfirmation
                confirmation={confirmation}
                onDismiss={() => setConfirmation(null)}
                className="not-empty:mt-2"
              />
              {exportRun.phase.kind === 'ready' && exportRun.phase.isPartial ? (
                <p
                  aria-live="polite"
                  className="mt-2 flex items-start gap-2 text-sm text-warning-muted-foreground"
                >
                  <LuTriangleAlert
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{t('downloadPartialNotice')}</span>
                </p>
              ) : null}
            </>
          }
        />
        <DataRow
          title={t('deleteAccountTitle')}
          hint={t('deleteAccountHint')}
          action={
            // nested in the settings dialog so Base UI stacks it and returns focus to the trigger
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                {tShared('Delete')}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('deleteAccountConfirmTitle')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('deleteAccountConfirmBody')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tShared('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    // mock: the account is not deleted yet
                    onClick={() => setIsDeleteOpen(false)}
                  >
                    {tShared('Delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </div>
    </div>
  );
};

const noticeContent = (
  notice: PersonalDataExportNotice,
  t: ReturnType<typeof useTranslations<'settings'>>,
): Pick<Confirmation, 'message' | 'tone'> => {
  switch (notice) {
    case 'started':
      return { message: t('downloadStarted'), tone: 'muted' };
    case 'ready':
      return { message: t('downloadReady'), tone: 'success' };
    case 'startError':
      return { message: t('downloadStartError'), tone: 'error' };
    case 'statusError':
      return { message: t('downloadStatusError'), tone: 'error' };
    case 'failed':
      return { message: t('downloadFailed'), tone: 'error' };
    case 'timeout':
      return { message: t('downloadTimeout'), tone: 'error' };
  }
};

const DownloadDataAction = ({
  phase,
  isStarting,
  isRetrying,
  start,
  retryDownload,
  markTaken,
}: ReturnType<typeof usePersonalDataExport>) => {
  const t = useTranslations('settings');

  if (phase.kind === 'ready') {
    // a link, not a button: the browser owns the download
    return (
      <ButtonLink
        variant="outline"
        href={phase.signedUrl}
        download={phase.fileName}
        target="_blank"
        rel="noopener noreferrer"
        onClick={markTaken}
      >
        <LuDownload aria-hidden />
        {t('downloadFileAction')}
      </ButtonLink>
    );
  }

  if (phase.kind === 'unsigned') {
    return (
      <Button
        variant="outline"
        disabled={isRetrying}
        aria-busy={isRetrying}
        onClick={() => {
          void retryDownload();
        }}
      >
        <LuDownload aria-hidden />
        {isRetrying ? t('downloadPreparing') : t('downloadRetryAction')}
      </Button>
    );
  }

  const isRunning = phase.kind === 'running';

  return (
    <Button
      variant="outline"
      // disabled rather than `loading` so the label stays readable while the run reports
      disabled={isRunning}
      loading={isStarting}
      aria-busy={isRunning}
      onClick={start}
    >
      {isRunning ? t('downloadPreparing') : t('downloadAction')}
    </Button>
  );
};

const DataRow = ({
  title,
  hint,
  action,
  footer,
}: {
  title: string;
  hint: string;
  action: ReactNode;
  footer?: ReactNode;
}) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <FieldTitle id={titleId} render={<h4 />}>
            {title}
          </FieldTitle>
          <FieldDescription>{hint}</FieldDescription>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {footer}
    </section>
  );
};
