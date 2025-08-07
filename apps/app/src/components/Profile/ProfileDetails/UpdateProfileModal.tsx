import { useUser } from '@/utils/UserProvider';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { UpdateProfileForm } from './UpdateProfileForm';

export const UpdateProfileModal = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) => {
  const { user } = useUser();
  const t = useTranslations();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) {
    return null;
  }

  return (
    <DialogTrigger>
      <Modal isOpen={isOpen} onOpenChange={setIsOpen} isDismissable>
        <ModalHeader>{t('Edit Profile')}</ModalHeader>
        {user.profile && (
          <UpdateProfileForm
            ref={formRef}
            profile={user.profile}
            onSuccess={() => setIsOpen(false)}
            className="p-6"
          />
        )}
      </Modal>
    </DialogTrigger>
  );
};
