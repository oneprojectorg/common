import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

export function ConfirmDeleteModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  return (
    <Modal
      isDismissable
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>
        <p>{message}</p>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="outline"
          className="w-full sm:w-fit"
          onPress={onCancel}
        >
          {t('Cancel')}
        </Button>
        <Button
          variant="destructive"
          className="w-full sm:w-fit"
          onPress={onConfirm}
        >
          {t('Delete')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
