'use client';

import { useUser } from '@/utils/UserProvider';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useState } from 'react';
import { LuPencil } from 'react-icons/lu';

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
        className="max-h-[39rem] w-[36rem] overflow-y-auto"
      >
        <ModalHeader>{t('Edit Profile')}</ModalHeader>
        <UpdateOrganizationForm
          profile={profile}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </Modal>
    </DialogTrigger>
  );
};
