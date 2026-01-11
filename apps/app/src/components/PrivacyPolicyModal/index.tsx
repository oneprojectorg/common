import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { PrivacyPolicyContent } from '../PrivacyPolicyContent';

export const PrivacyPolicyModal = () => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger>
      <Button
        unstyled
        onPress={() => setIsOpen(true)}
        className="text-primary-teal hover:underline"
      >
        {t('Privacy Policy')}
      </Button>

      <Modal
        className="sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem] h-screen max-h-none w-screen max-w-none overflow-y-auto"
        onOpenChange={setIsOpen}
        isDismissable
        isOpen={isOpen}
      >
        <Dialog>
          <ModalHeader>{t('Privacy Policy')}</ModalHeader>
          <ModalBody>
            <PrivacyPolicyContent />
          </ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
