import { useUser } from '@/utils/UserProvider';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect } from 'react';
import { LuX } from 'react-icons/lu';

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
      <Modal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
        className="w-[95vw] max-h-[39rem] max-w-[36rem] overflow-y-auto sm:w-[36rem]"
      >
        <ModalHeader className="flex items-center justify-between">
          {t('Edit Profile')}
          <LuX
            className="size-6 cursor-pointer stroke-1"
            onClick={() => setIsOpen(false)}
          />
        </ModalHeader>
        <UpdateProfileForm
          profile={user}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </Modal>
    </DialogTrigger>
  );
};
