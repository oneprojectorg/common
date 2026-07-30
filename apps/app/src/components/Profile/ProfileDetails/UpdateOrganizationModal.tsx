'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import type { Organization } from '@op/api/encoders';
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

import { UpdateOrganizationForm } from './UpdateOrganizationForm';

interface UpdateOrganizationModalProps {
  organization: Organization;
}

export const UpdateOrganizationModal = ({
  organization,
}: UpdateOrganizationModalProps) => {
  const { user } = useRequiredUser();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Only show edit button if user belongs to this organization
  const canEdit = user.currentProfile?.id === organization.profile.id;

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
        <UpdateOrganizationForm
          ref={formRef}
          profile={organization}
          onSuccess={() => setIsOpen(false)}
          className="p-6"
        />
      </DialogContent>
    </Dialog>
  );
};
