'use client';

import { Button } from '@op/sense/Button';
import { Dialog, DialogContent, DialogTitle } from '@op/sense/Dialog';
import { Header1 } from '@op/sense/Header';
import { CheckIcon } from '@op/sense/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export const NewlyJoinedModal = () => {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNew = searchParams.get('new');
  const [modalOpen, setModalOpen] = useState(!!isNew);

  useEffect(() => {
    setModalOpen(!!isNew);
  }, [isNew]);

  const handleModalChange = (open: boolean) => {
    setModalOpen(open);

    if (!open && isNew) {
      // Remove 'new' param from URL
      const params = new URLSearchParams(window.location.search);

      params.delete('new');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

      router.replace(newUrl);
    }
  };

  return (
    <Dialog open={modalOpen} onOpenChange={handleModalChange}>
      <DialogContent
        confetti
        className="shadow-green inset-shadow-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("You're all set!")}</DialogTitle>
        <div className="p-12 text-center">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center justify-center gap-4">
              <CheckIcon className="size-20" />
              <div className="flex flex-col gap-2">
                <Header1 className="sm:text-title-lg">
                  {t("You're all set!")}
                </Header1>
                <p className="text-muted-foreground">
                  {t(
                    "You've successfully joined Common. Your organization's profile is now visible to aligned collaborators and funders.",
                  )}
                </p>
              </div>
            </div>
            <Button className="w-full" onClick={() => handleModalChange(false)}>
              {t('Take me to Common')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
