'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

import { OverviewHeroImageField } from './OverviewHeroImageField';

/**
 * Controlled modal for uploading/removing the overview hero image. Shared by
 * the desktop "Edit banner" button and the mobile admin bottom sheet. The
 * overview page is RSC-fed, so a change reloads to pull the new hero.
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

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalHeader>{t('Edit banner')}</ModalHeader>
      <ModalBody>
        <OverviewHeroImageField
          instanceId={instanceId}
          initialPath={heroImagePath}
          // Hard reload rather than the client router. This modal opens on the
          // live overview, which is often viewed at a vanity URL (e.g.
          // `/columbus`) that only exists as a next.config rewrite to
          // `/decisions/columbus`. A client-side refresh re-fetches the RSC for
          // the rewrite-only path, which falls into the walled `(main)` group
          // and 404s (prod only; dev re-applies rewrites per request). A full
          // load lets the server resolve the rewrite — same as a manual
          // refresh. Banner edits are rare, so the reload cost is negligible.
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
