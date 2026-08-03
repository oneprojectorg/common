import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';

import { useTranslations } from '@/lib/i18n';

import { CommunityCommitmentsContent } from '@/components/CommunityCommitmentsContent';

export const CommunityCommitmentsModal = () => {
  const t = useTranslations();

  return (
    <DialogTrigger>
      <Button unstyled className="text-primary-teal hover:underline">
        {t('Commitments')}
      </Button>

      <Modal
        className="h-screen max-h-none w-screen max-w-none overflow-y-auto sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem]"
        isDismissable
      >
        <Dialog>
          <ModalHeader>{t('Community Commitments')}</ModalHeader>
          <ModalBody>
            <CommunityCommitmentsContent />
          </ModalBody>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
