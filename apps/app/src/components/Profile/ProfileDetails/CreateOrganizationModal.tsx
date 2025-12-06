'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useRef, useState } from 'react';
import { LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CreateOrganizationForm } from './CreateOrganizationForm';
import { CreateOrganizationSuccessModal } from './CreateOrganizationSuccessModal';

interface CreateOrganizationModalProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const CreateOrganizationModal = ({
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateOrganizationModalProps) => {
  const t = useTranslations();
  const [isInternalFormOpen, setIsInternalFormOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [orgName, setOrgName] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);

  const isModalOpen = controlledIsOpen ?? isInternalFormOpen;
  const setIsModalOpen = controlledOnOpenChange ?? setIsInternalFormOpen;

  const onSubmit = (name?: string) => {
    setOrgName(name);
    setIsModalOpen(false);
    setIsSuccessOpen(true);
  };

  const onSuccess = () => {
    setIsSuccessOpen(false);
  };

  const onError = () => {
    setIsSuccessOpen(false);
    setIsModalOpen(true);
  };

  return (
    <>
      <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen} isDismissable>
        <ModalHeader>{t('Create Organization')}</ModalHeader>
        <CreateOrganizationForm
          ref={formRef}
          onSubmit={onSubmit}
          onSuccess={onSuccess}
          onError={onError}
          className="p-6"
        />
      </Modal>
      <CreateOrganizationSuccessModal
        isOpen={isSuccessOpen}
        organizationName={orgName}
      />
    </>
  );
};

export const CreateOrganizationModalTrigger = () => {
  const t = useTranslations();
  return (
    <>
      <DialogTrigger>
        <Button color="primary" className="min-w-full sm:min-w-fit">
          <LuPencil className="size-4" />
          {t('Edit Profile')}
        </Button>
        <CreateOrganizationModal />
      </DialogTrigger>
    </>
  );
};
