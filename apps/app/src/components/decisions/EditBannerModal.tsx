'use client';

import { Button } from '@op/sense/Button';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { BannerUploadModal } from './BannerUploadModal';

/**
 * Desktop "Edit banner" control on the overview hero (top-right). Hidden on
 * mobile, where the admin bar + bottom sheet (AdminOverviewBar) takes over.
 */
export function EditBannerModal({
  instanceId,
  heroImagePath,
}: {
  instanceId: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="absolute end-4 top-4 z-10 hidden md:flex"
        onClick={() => setIsOpen(true)}
      >
        <LuImage className="size-4" aria-hidden="true" />
        {t('Edit banner')}
      </Button>
      <BannerUploadModal
        instanceId={instanceId}
        heroImagePath={heroImagePath}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
