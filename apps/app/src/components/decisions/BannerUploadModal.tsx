'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';

import { useRouter, useTranslations } from '@/lib/i18n';

import { OverviewHeroImageField } from './OverviewHeroImageField';

/**
 * Controlled modal for uploading/removing the overview hero image. Shared by
 * the desktop "Edit banner" button and the mobile admin bottom sheet. The
 * overview page is RSC-fed, so a change triggers router.refresh().
 */
export function BannerUploadModal({
  instanceId,
  heroImagePath,
  isOpen,
  onOpenChange,
}: {
  instanceId: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalHeader>{t('Edit banner')}</ModalHeader>
      <ModalBody>
        <OverviewHeroImageField
          instanceId={instanceId}
          initialPath={heroImagePath}
          onChange={() => router.refresh()}
        />
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onPress={() => onOpenChange(false)}>
          {t('Done')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
