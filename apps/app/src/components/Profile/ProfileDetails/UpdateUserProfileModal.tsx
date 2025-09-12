'use client';

import { useUser } from '@/utils/UserProvider';
import type { Profile } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useRef, useState } from 'react';
import { LuPencil } from 'react-icons/lu';

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
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Only show edit button if this is the user's own profile
  const canEdit = user?.currentProfile?.id === profile.id;

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
      <Modal isOpen={isOpen} onOpenChange={setIsOpen} isDismissable>
        <ModalHeader>{t('Edit Profile')}</ModalHeader>

        {user?.currentProfile && (
          <UpdateProfileForm
            ref={formRef}
            profile={profile}
            onSuccess={() => setIsOpen(false)}
            className="p-6"
          />
        )}
      </Modal>
    </DialogTrigger>
  );
};
