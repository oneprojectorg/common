'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import type { Profile } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
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
  const { user } = useRequiredUser();
  const t = useTranslations();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Only show edit button if this is the user's own profile
  const canEdit = user.currentProfile?.id === profile.id;

  if (!canEdit) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button className="min-w-full sm:min-w-fit">
            <LuPencil className="size-4" />
            {t('Edit Profile')}
          </Button>
        }
      />
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Edit Profile')}</DialogTitle>
        </DialogHeader>
        {user.currentProfile && (
          <UpdateProfileForm
            ref={formRef}
            profile={profile}
            onSuccess={() => setIsOpen(false)}
            className="p-6"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
