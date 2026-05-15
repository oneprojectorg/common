import { Button } from '@op/ui-next/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui-next/Modal';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CoCContent } from '@/components/CoCContent';

export const CoCModal = () => {
  const t = useTranslations();
  const [isToSOpen, setIsToSOpen] = useState(false);

  return (
    <>
      <Button
        unstyled
        onPress={() => setIsToSOpen(true)}
        className="text-primary-teal hover:underline"
      >
        {t('Code of Conduct')}
      </Button>

      <Modal onOpenChange={setIsToSOpen} isDismissable isOpen={isToSOpen}>
        <ModalHeader>{t('Code of Conduct')}</ModalHeader>
        <ModalBody>
          <CoCContent />
        </ModalBody>
      </Modal>
    </>
  );
};
