import { Button } from '@op/ui-next/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui-next/Modal';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ToSContent } from '@/components/ToSContent';

export const ToSModal = () => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        unstyled
        className="text-primary-teal hover:underline"
        onPress={() => setIsOpen(true)}
      >
        {t('Terms of Use')}
      </Button>

      <Modal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        className="h-screen max-h-none w-screen max-w-none overflow-y-auto sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem]"
        isDismissable
      >
        <ModalHeader>{t('Terms of Use')}</ModalHeader>
        <ModalBody>
          <ToSContent />
        </ModalBody>
      </Modal>
    </>
  );
};
