'use client';

import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

export const CreateOrganizationSuccessModal = ({
  isOpen,
  organizationName,
}: {
  isOpen: boolean;
  organizationName?: string;
}) => {
  const t = useTranslations();

  return (
    <Modal isOpen={isOpen}>
      <ModalBody className="gap-6 p-12 flex h-full flex-col items-center justify-center text-center">
        <p>
          {t('Setting up')}{' '}
          <span className="font-semibold">
            {organizationName || t('your organization')}
          </span>
          ...
        </p>
        <LoadingSpinner />
      </ModalBody>
    </Modal>
  );
};
