'use client';

import { Dialog, DialogContent, DialogTitle } from '@op/sense/Dialog';
import { Spinner } from '@op/sense/Spinner';

import { useTranslations } from '@/lib/i18n';

export const CreateOrganizationSuccessModal = ({
  isOpen,
  organizationName,
}: {
  isOpen: boolean;
  organizationName?: string;
}) => {
  const t = useTranslations();

  return (
    // No onOpenChange: this is a transient "setting up" state the parent flips
    // off on success, so the dialog is intentionally non-dismissable (Esc/overlay
    // no-op, close button hidden).
    <Dialog open={isOpen}>
      <DialogContent showCloseButton={false}>
        <DialogTitle className="sr-only">{t('Setting up')}</DialogTitle>
        <div className="flex h-full flex-col items-center justify-center gap-6 p-12 text-center">
          <p>
            {t('Setting up')}{' '}
            <span className="font-semibold">
              {organizationName || t('your organization')}
            </span>
            ...
          </p>
          <Spinner className="size-6" />
        </div>
      </DialogContent>
    </Dialog>
  );
};
