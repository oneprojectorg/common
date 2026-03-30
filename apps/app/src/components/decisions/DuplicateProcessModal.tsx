'use client';

import type { DecisionProfile } from '@op/api/encoders';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

export const DuplicateProcessModal = ({
  item: _item,
  onClose,
}: {
  item: DecisionProfile;
  onClose: () => void;
}) => {
  const t = useTranslations();

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} surface="flat">
      <ModalHeader className="pl-6 text-left">
        {t('Duplicate process')}
      </ModalHeader>
      <ModalBody>
        <p>{t('Duplicate process modal coming soon.')}</p>
      </ModalBody>
    </Modal>
  );
};
