'use client';

import { useUser } from '@/utils/UserProvider';
import type { Profile } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect, useRef, useState } from 'react';
import { LuPencil, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UpdateProfileForm } from './UpdateProfileForm';

interface UpdateUserProfileModalProps {
  profile: Profile;
}

export const UpdateUserProfileModal = ({
  profile,
}: UpdateUserProfileModalProps) => {
  const { user } = useUser();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Only show edit button if this is the user's own profile
  const canEdit = user?.currentProfile?.id === profile.id;

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

  if (!canEdit) {
    return null;
  }

  return (
    <DialogTrigger>
      <Button
        onPress={() => setIsOpen(true)}
        color="primary"
        className="min-w-full sm:min-w-fit"
      >
        <LuPencil className="size-4" />
        {t('Edit Profile')}
      </Button>
      <Modal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
        className="h-svh max-h-none w-screen max-w-none overflow-y-auto rounded-none sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem] sm:rounded-md"
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