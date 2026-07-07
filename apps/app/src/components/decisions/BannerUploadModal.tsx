'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

import { HeroImageField } from './HeroImageField';

/**
 * Controlled modal for uploading/removing a decision hero image, scoped to the
 * overview (no `phaseId`) or a single phase (`phaseId`). Used by the "Edit
 * banner" button and the mobile admin bottom sheet. Live pages are RSC-fed and
 * often viewed at vanity-URL rewrites, so a change hard-reloads to pull the new
 * hero (a client refresh of a rewrite-only path 404s in prod).
 */
export function BannerUploadModal({
  instanceId,
  phaseId,
  heroImagePath,
  isOpen,
  onOpenChange,
}: {
  instanceId: string;
  /** When set, targets that phase's banner; otherwise the overview banner. */
  phaseId?: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalHeader>{t('Edit banner')}</ModalHeader>
      <ModalBody>
        <HeroImageField
          instanceId={instanceId}
          phaseId={phaseId}
          initialPath={heroImagePath}
          onChange={() => window.location.reload()}
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
