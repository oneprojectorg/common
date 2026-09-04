'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
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

  const onError = () => {
    setIsSuccessOpen(false);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (isNew) {
      setIsSuccessOpen(false);
    }
  }, [isNew]);

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Create Organization')}</DialogTitle>
          </DialogHeader>
          <CreateOrganizationForm
            onSubmit={onSubmit}
            onError={onError}
            className="p-6"
          />
        </DialogContent>
      </Dialog>
      <CreateOrganizationSuccessModal
        isOpen={isSuccessOpen}
        organizationName={orgName}
      />
    </>
  );
};

export const CreateOrganizationModalTrigger = () => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="min-w-full sm:min-w-fit"
      >
        <LuPlus className="size-4" />
        {t('Create Organization')}
      </Button>
      <CreateOrganizationModal isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
};
