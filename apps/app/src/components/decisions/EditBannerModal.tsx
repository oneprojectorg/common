'use client';

import { Button } from '@op/ui/Button';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { BannerUploadModal } from './BannerUploadModal';

/**
 * "Edit banner" control on a decision hero (top-right, desktop-only, admin),
 * scoped to the overview (no `phaseId`) or a single phase (`phaseId`). Opens
 * the shared upload/remove modal. Hidden below md — the mobile admin bar +
 * bottom sheet (AdminOverviewBar) takes over there.
 */
export function EditBannerModal({
  instanceId,
  phaseId,
  heroImagePath,
}: {
  instanceId: string;
  /** When set, targets that phase's banner; otherwise the overview banner. */
  phaseId?: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        color="secondary"
        size="small"
        className="absolute top-4 right-4 z-10 hidden md:flex"
        onPress={() => setIsOpen(true)}
      >
        <LuImage className="size-4" aria-hidden="true" />
        {t('Edit banner')}
      </Button>
      <BannerUploadModal
        instanceId={instanceId}
        phaseId={phaseId}
        heroImagePath={heroImagePath}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
