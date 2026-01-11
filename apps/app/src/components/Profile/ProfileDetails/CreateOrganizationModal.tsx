'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CreateOrganizationForm } from './CreateOrganizationForm';
import { CreateOrganizationSuccessModal } from './CreateOrganizationSuccessModal';

export const CreateOrganizationModal = ({
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();
  const [isInternalFormOpen, setIsInternalFormOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [orgName, setOrgName] = useState<string | undefined>();

  const searchParams = useSearchParams();
  const isNew = searchParams.get('new');

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

  useEffect(() => {
    if (isNew) {
      onSuccess();
    }
  }, [isNew, onSuccess]);

  return (
    <>
      <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen} isDismissable>
        <ModalHeader>{t('Create Organization')}</ModalHeader>
        <CreateOrganizationForm
          onSubmit={onSubmit}
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
          <LuPlus className="size-4" />
          {t('Create Organization')}
        </Button>
        <CreateOrganizationModal />
      </DialogTrigger>
    </>
  );
};
