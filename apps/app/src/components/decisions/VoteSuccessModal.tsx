'use client';

import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { DialogTrigger } from '@op/ui/Dialog';
import { Header1, Header3 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

export const VoteSuccessModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const t = useTranslations();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal isDismissable confetti>
        <div className="z-10 p-12 text-center">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-16 flex-col items-center justify-center gap-4">
                <CheckIcon />
              </div>

              <div className="flex flex-col gap-2">
                <Header1 className="font-serif text-2xl font-light">
                  {t('Your ballot is in!')}
                </Header1>

                <p className="text-base text-neutral-charcoal">
                  {t(
                    'Thank you for participating in the 2025 Community Vote. Your voice helps shape how we invest in our community.',
                  )}
                </p>
              </div>

              <div className="flex w-full flex-col gap-6 text-left text-base text-neutral-charcoal">
                <Header3>{t("Here's what will happen next:")}</Header3>
                <ul className="flex flex-col gap-4 pl-4">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>{t('Voting closes in 7 days on Oct 30, 2025')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>{t('Results will be shared on Nov 5, 2025')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      {t("You'll receive an email with the final results")}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <Button onPress={onClose} color="primary" className="w-full">
              {t('View all proposals')}
            </Button>
          </div>
        </div>
      </Modal>
    </DialogTrigger>
  );
};
