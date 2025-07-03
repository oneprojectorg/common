'use client';

import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { Header1 } from '@op/ui/Header';
import { Modal, ModalBody } from '@op/ui/Modal';

interface InviteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteMore: () => void;
  invitedEmail: string;
  organizationName: string;
}

export const InviteSuccessModal = ({
  isOpen,
  onClose,
  onInviteMore,
  invitedEmail,
  organizationName,
}: InviteSuccessModalProps) => {
  return (
    <Modal isOpen={isOpen} className="inset-shadow-none shadow-green">
      <ModalBody className="flex flex-col items-center justify-center gap-6 p-12 text-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <CheckIcon />
          <Header1 className="sm:text-title-lg">Sent</Header1>
        </div>
        <p>
          You've invited <span className="font-semibold">{invitedEmail}</span>{' '}
          to join <span className="font-semibold">{organizationName}</span> as
          an admin.
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button color="primary" onPress={onClose} className="w-full">
            Done
          </Button>
          <Button color="secondary" onPress={onInviteMore} className="w-full">
            Invite more people
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};
