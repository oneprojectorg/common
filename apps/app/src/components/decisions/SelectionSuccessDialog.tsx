'use client';

import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { DialogTrigger } from '@op/ui/Dialog';
import { Header1 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

interface SelectionSuccessDialogProps {
  count: number | null;
  onClose: () => void;
}

export const SelectionSuccessDialog = ({
  count,
  onClose,
}: SelectionSuccessDialogProps) => {
  const t = useTranslations();

  return (
    <DialogTrigger
      isOpen={count !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal isDismissable confetti>
        <div className="z-10 p-12 text-center">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-16 flex-col items-center justify-center gap-4">
                <CheckIcon />
              </div>
              <div className="flex flex-col gap-2">
                <Header1 className="font-serif text-2xl font-light">
                  {t('Proposals advanced')}
                </Header1>
                <p className="text-base text-neutral-charcoal">
                  {t(
                    '{count} proposals are now attached to this phase. Participants can view them.',
                    { count: count ?? 0 },
                  )}
                </p>
              </div>
            </div>
            <Button onPress={onClose} color="primary" className="w-full">
              {t('Done')}
            </Button>
          </div>
        </div>
      </Modal>
    </DialogTrigger>
  );
};
