import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CoCContent } from '@/components/CoCContent';

export const CoCModal = () => {
  const t = useTranslations();
  const [isToSOpen, setIsToSOpen] = useState(false);

  return (
    <DialogTrigger>
      <Button
        unstyled
        onPress={() => setIsToSOpen(true)}
        className="text-primary-teal hover:underline"
      >
        {t('Code of Conduct')}
      </Button>

      <Modal
        className="h-screen max-h-none w-screen max-w-none overflow-y-auto sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem]"
        onOpenChange={setIsToSOpen}
        isDismissable
        isOpen={isToSOpen}
      >
        <Dialog>
          <ModalHeader className="flex items-center justify-between">
            {t('Code of Conduct')}
            <LuX
              className="size-6 cursor-pointer stroke-1"
              onClick={() => setIsToSOpen(false)}
            />
          </ModalHeader>
          <ModalBody>
            <CoCContent />
          </ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
