import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ToSContent } from '@/components/ToSContent';

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
        {t('Terms of Use')}
      </Button>

      <Modal
        className="h-screen max-h-none w-screen max-w-none overflow-y-auto sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem]"
        onOpenChange={setIsToSOpen}
        isDismissable
        isOpen={isToSOpen}
      >
        <Dialog>
          <ModalHeader className="flex items-center justify-between">
            {t('Terms of Use')}
            <LuX
              className="size-6 cursor-pointer stroke-1"
              onClick={() => setIsToSOpen(false)}
            />
          </ModalHeader>
          <ModalBody>
            <ToSContent />
          </ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
