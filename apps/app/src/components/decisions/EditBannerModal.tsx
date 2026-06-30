'use client';

import { Button } from '@op/ui/Button';
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
  backgroundImagePath,
}: {
  instanceId: string;
  /** Stored storage path of the current background, if any. */
  backgroundImagePath?: string;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        color="secondary"
        size="small"
        className="hidden md:flex"
        onPress={() => setIsOpen(true)}
      >
        <LuImage className="size-4" aria-hidden="true" />
        {t('Edit banner')}
      </Button>
      <BannerUploadModal
        instanceId={instanceId}
        backgroundImagePath={backgroundImagePath}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
