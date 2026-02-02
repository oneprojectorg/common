'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import he from 'he';
import { DialogTrigger } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

interface ProposalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export function ProposalInfoModal({
  isOpen,
  onClose,
  title,
  content,
}: ProposalInfoModalProps) {
  const t = useTranslations();

  // This is a hack for people powered needing translated content before we support it in user-generated content
  const translatedContent = !!content.match('INFOTRANSLATION');

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal
        isDismissable
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <div className="flex h-full max-h-[80vh] w-full max-w-2xl flex-col">
          <ModalHeader>{title}</ModalHeader>

          <ModalBody className="flex-1 overflow-y-auto">
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{
                __html: translatedContent
                  ? he.decode(t('INFOTRANSLATION'))
                  : content,
              }}
            />
          </ModalBody>

          <div className="flex justify-end border-t bg-white px-6 py-4">
            <Button variant="primary" onPress={onClose}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </DialogTrigger>
  );
}
