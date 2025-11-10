import { Dialog } from '@op/ui/Dialog';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { User } from './types';
import { PlatformAdminUpdateProfileForm } from './PlatformAdminUpdateProfileForm';

export const PlatformAdminEditProfileModal = ({
  user,
  isOpen,
  onOpenChange,
  onSuccess,
}: {
  user: User;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
}) => {
  const t = useTranslations();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  if (!user.profile) {
    return null;
  }

  return (
    <DialogTrigger>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
        <Dialog>
          <ModalHeader>{t('Edit Profile')}</ModalHeader>
          <PlatformAdminUpdateProfileForm
            user={user}
            profile={user.profile}
            onSuccess={() => {
              onSuccess();
              onOpenChange(false);
            }}
            className="p-6"
          />
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
