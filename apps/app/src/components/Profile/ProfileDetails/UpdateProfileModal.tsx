'use client';

import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UpdateProfileForm } from './UpdateProfileForm';

export const UpdateProfileModal = () => {
  const { user } = useUser();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

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
      <Button onPress={() => setIsOpen(true)} unstyled className="">
        <span className="text-primary-teal">{t('Edit Profile')}</span>)
      </Button>
      <Modal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
        className="max-h-[39rem] w-[36rem] max-w-[36rem] overflow-y-auto"
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
