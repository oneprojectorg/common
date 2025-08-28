'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger, ModalOverlay } from 'react-aria-components';

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
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalOverlay>
        <Modal isDismissable>
          <div className="flex h-full max-h-[80vh] w-full max-w-2xl flex-col">
            <ModalHeader>{title}</ModalHeader>

            <ModalBody className="flex-1 overflow-y-auto">
              <div
                className="prose prose-gray max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </ModalBody>

            <div className="border-neutral-lightgray flex justify-end border-t bg-white px-6 py-4">
              <Button variant="primary" onPress={onClose}>
                OK
              </Button>
            </div>
          </div>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
