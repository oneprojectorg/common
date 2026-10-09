'use client';

import { Button } from '@op/sense/Button';
import { FieldDescription, FieldTitle } from '@op/sense/Field';
import { Header3 } from '@op/sense/Header';
import { type ReactNode, useId, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ConfirmDeleteModal } from '../ConfirmDeleteModal';
import { type Confirmation, InlineConfirmation } from './InlineConfirmation';

/**
 * The Your data tab: download a copy of everything, or delete the account
 * (after a confirmation).
 */
export const YourDataSettings = () => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationCount = useRef(0);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Header3>{t('yourDataTab')}</Header3>
      <div className="flex flex-col gap-8">
        <DataRow
          title={t('downloadDataTitle')}
          hint={t('downloadDataHint')}
          action={
            <Button
              variant="outline"
              onClick={() => {
                // TODO: request the export from the API.
                confirmationCount.current += 1;
                setConfirmation({
                  id: confirmationCount.current,
                  message: t('downloadStarted'),
                  tone: 'success',
                });
              }}
            >
              {t('downloadAction')}
            </Button>
          }
          footer={
            <InlineConfirmation
              confirmation={confirmation}
              onDismiss={() => setConfirmation(null)}
              className="not-empty:mt-2"
            />
          }
        />
        <DataRow
          title={t('deleteAccountTitle')}
          hint={t('deleteAccountHint')}
          action={
            <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
              {tShared('Delete')}
            </Button>
          }
        />
      </div>
      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        title={t('deleteAccountConfirmTitle')}
        message={t('deleteAccountConfirmBody')}
        // TODO: delete the account through the API.
        onConfirm={() => setIsDeleteOpen(false)}
        onCancel={() => setIsDeleteOpen(false)}
      />
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
