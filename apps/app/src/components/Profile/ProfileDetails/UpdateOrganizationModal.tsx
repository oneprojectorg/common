'use client';

import { useUser } from '@/utils/UserProvider';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect, useRef, useState } from 'react';
import { LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { UpdateOrganizationForm } from './UpdateOrganizationForm';

interface UpdateOrganizationModalProps {
  organization: Organization;
}

export const UpdateOrganizationModal = ({
  organization,
}: UpdateOrganizationModalProps) => {
  const { user } = useUser();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Only show edit button if user belongs to this organization
  const canEdit = user.currentProfile?.id === organization.profile.id;

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
        className="sm:min-w-fit min-w-full"
      >
        <LuPencil className="size-4" />
        {t('Edit Profile')}
      </Button>
      <Modal isOpen={isOpen} onOpenChange={setIsOpen} isDismissable>
        <ModalHeader>{t('Edit Profile')}</ModalHeader>
        <UpdateOrganizationForm
          ref={formRef}
          profile={organization}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </Modal>
    </DialogTrigger>
  );
};
