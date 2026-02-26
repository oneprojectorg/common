'use client';

import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { Header1 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';
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
    <Modal
      className="shadow-green inset-shadow-none"
      isOpen={modalOpen}
      onOpenChange={handleModalChange}
      confetti={false}
    >
      <div className="z-10 p-12 text-center">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center gap-4">
            <CheckIcon />
            <div className="flex flex-col gap-2">
              <Header1 className="sm:text-title-lg">
                {t("You're all set!")}
              </Header1>
              {t(
                "You've successfully joined Common. Your organization's profile is now visible to aligned collaborators and funders.",
              )}
            </div>
          </div>
          <Button className="w-full" onPress={() => handleModalChange(false)}>
            {t('Take me to Common')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
