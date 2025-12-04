'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useEffect, useRef, useState } from 'react';
import { LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CreateOrganizationForm } from './CreateOrganizationForm';

interface CreateOrganizationModalProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const CreateOrganizationModal = ({
  isOpen: controlledIsOpen,
  onOpenChange: controlledSetIsOpen,
}: CreateOrganizationModalProps) => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
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

  if (isOpen !== undefined) {
    return (
      <Modal
        isOpen={controlledIsOpen}
        onOpenChange={controlledSetIsOpen}
        isDismissable
      >
        <ModalHeader>{t('Create Organization')}</ModalHeader>
        <CreateOrganizationForm
          ref={formRef}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </Modal>
    );
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
        <CreateOrganizationForm
          ref={formRef}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </Modal>
    </DialogTrigger>
  );
};
