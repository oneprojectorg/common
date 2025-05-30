'use client';

import { useUser } from '@/utils/UserProvider';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect, useState } from 'react';
import { LuPencil, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UpdateOrganizationForm } from './UpdateOrganizationForm';

interface UpdateOrganizationModalProps {
  profile: Organization;
}

export const UpdateOrganizationModal = ({
  profile,
}: UpdateOrganizationModalProps) => {
  const { user } = useUser();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  // Only show edit button if user belongs to this organization
  const canEdit = user?.currentOrganization?.id === profile.id;

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
        className="max-h-[39rem] w-[36rem] max-w-[36rem] overflow-y-auto"
      >
        <ModalHeader className="flex items-center justify-between">
          {t('Edit Profile')}
          <LuX
            className="size-6 cursor-pointer stroke-1"
            onClick={() => setIsOpen(false)}
          />
        </ModalHeader>
        <UpdateOrganizationForm
          profile={profile}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </Modal>
    </DialogTrigger>
  );
};
