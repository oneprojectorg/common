'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
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
import { type ReactNode, useId, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  DownloadDataAction,
  DownloadDataPartialNotice,
} from '../PersonalDataExport/DownloadDataAction';

export const YourDataSettings = () => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const downloadDataEnabled = useFeatureFlag('download-user-data');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Header3>{t('yourDataTab')}</Header3>
      <div className="flex flex-col gap-8">
        {downloadDataEnabled ? (
          <DataRow
            title={t('downloadDataTitle')}
            hint={t('downloadDataHint')}
            action={<DownloadDataAction />}
            footer={<DownloadDataPartialNotice />}
          />
        ) : null}
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
