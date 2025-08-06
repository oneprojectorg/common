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

      <Modal onOpenChange={setIsToSOpen} isDismissable isOpen={isToSOpen}>
        <Dialog>
          <ModalHeader>{t('Code of Conduct')}</ModalHeader>
          <ModalBody>
            <CoCContent />
          </ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
