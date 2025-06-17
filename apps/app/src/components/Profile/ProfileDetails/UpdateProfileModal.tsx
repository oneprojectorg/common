import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect, useRef } from 'react';
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
      <Modal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
        className="h-screen max-h-none w-screen max-w-none overflow-y-auto sm:h-auto sm:max-h-[39rem] sm:w-[36rem] sm:max-w-[36rem]"
      >
        <ModalHeader className="flex items-center justify-between">
          {/* Desktop header */}
          <div className="hidden sm:flex sm:w-full sm:items-center sm:justify-between">
            {t('Edit Profile')}
            <LuX
              className="size-6 cursor-pointer stroke-1"
              onClick={() => setIsOpen(false)}
            />
          </div>

          {/* Mobile header */}
          <div className="flex w-full items-center justify-between sm:hidden">
            <Button
              unstyled
              className="font-sans text-base text-primary-teal"
              onPress={() => setIsOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <h2 className="text-title-sm">{t('Edit Profile')}</h2>
            <Button
              type="submit"
              className="font-sans text-base text-primary-teal"
              unstyled
              form="update-profile-form"
            >
              {t('Save')}
            </Button>
          </div>
        </ModalHeader>
        <UpdateProfileForm
          ref={formRef}
          profile={user}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </Modal>
    </DialogTrigger>
  );
};
