import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export const ToSModal = () => {
  const t = useTranslations();
  const [isToSOpen, setIsToSOpen] = useState(false);

  return (
    <DialogTrigger>
      <Button
        unstyled
        onPress={() => setIsToSOpen(true)}
        className="text-primary-teal hover:underline"
      >
        {t('Terms of Service')}
      </Button>

      <Modal
        className="min-w-[29rem]"
        onOpenChange={setIsToSOpen}
        isDismissable
        isOpen={isToSOpen}
      >
        <Dialog>
          <ModalHeader className="flex items-center justify-between">
            {t('Terms of Service')}
            <LuX
              className="size-6 cursor-pointer stroke-1"
              onClick={() => setIsToSOpen(false)}
            />
          </ModalHeader>
          <ModalBody>ToS</ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
