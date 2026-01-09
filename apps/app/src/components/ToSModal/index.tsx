import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';

import { useTranslations } from '@/lib/i18n';

import { ToSContent } from '@/components/ToSContent';

export const ToSModal = () => {
  const t = useTranslations();

  return (
    <DialogTrigger>
      <Button unstyled className="text-primary-teal hover:underline">
        {t('Terms of Use')}
      </Button>

      <Modal
        className="sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem] h-screen max-h-none w-screen max-w-none overflow-y-auto"
        isDismissable
      >
        <Dialog>
          <ModalHeader>{t('Terms of Use')}</ModalHeader>
          <ModalBody>
            <ToSContent />
          </ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
