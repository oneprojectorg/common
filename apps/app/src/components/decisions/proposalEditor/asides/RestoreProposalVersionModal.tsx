'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { useLocale } from 'next-intl';

import { useTranslations } from '@/lib/i18n';

interface RestoreProposalVersionModalProps {
  isOpen: boolean;
  isPending: boolean;
  versionDate: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirms restoring a saved proposal version before mutating the live draft.
 */
export function RestoreProposalVersionModal({
  isOpen,
  isPending,
  versionDate,
  onClose,
  onConfirm,
}: RestoreProposalVersionModalProps) {
  const locale = useLocale();
  const t = useTranslations();

  const formattedDate = formatDate(versionDate, locale, DATE_TIME_UTC_FORMAT);

  return (
    <Modal
      isDismissable={!isPending}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onClose();
        }
      }}
      surface="flat"
    >
      <ModalHeader>{t('Restore this version?')}</ModalHeader>
      <ModalBody className="gap-4 text-base text-neutral-charcoal">
        <p>
          {t('Your proposal will be restored to the version from {date}.', {
            date: formattedDate,
          })}
        </p>
        <p>
          {t(
            'Your current version will be saved and you can restore it anytime.',
          )}
        </p>
      </ModalBody>
      <ModalFooter className="border-t border-neutral-gray1">
        <Button color="secondary" onPress={onClose} isDisabled={isPending}>
          {t('Keep current')}
        </Button>
        <Button onPress={onConfirm} isPending={isPending}>
          {t('Restore')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
