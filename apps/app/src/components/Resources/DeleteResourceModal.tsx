'use client';

import { useTranslations } from '@/lib/i18n';

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';

export const DeleteResourceModal = ({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const t = useTranslations();
  return (
    <ConfirmDeleteModal
      isOpen={isOpen}
      title={t('Delete this resource?')}
      message={t('This action cannot be undone.')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
