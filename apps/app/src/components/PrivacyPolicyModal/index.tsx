import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export const PrivacyPolicyModal = () => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger>
      <Button
        unstyled
        onPress={() => setIsOpen(true)}
        className="text-primary-teal"
      >
        {t('Privacy Policy')}
      </Button>

      <Modal
        className="min-w-[29rem]"
        onOpenChange={setIsOpen}
        isDismissable
        isOpen={isOpen}
      >
        <Dialog>
          <ModalHeader className="flex items-center justify-between">
            {t('Privacy Policy')}
            <LuX
              className="size-6 cursor-pointer stroke-1"
              onClick={() => setIsOpen(false)}
            />
          </ModalHeader>
          <ModalBody>Privacy Policy</ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
