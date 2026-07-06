'use client';

import { Button } from '@op/ui/Button';
import { cn } from '@op/ui/utils';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { BannerUploadModal } from './BannerUploadModal';

/**
 * "Add banner" / "Edit banner" control on a decision hero (top-right,
 * admin-only), scoped to the overview (no `phaseId`) or a single phase
 * (`phaseId`). Opens the shared upload/remove modal. On the overview, pass
 * `hideOnMobile` since the mobile admin bar + bottom sheet (AdminOverviewBar)
 * takes over there.
 */
export function EditBannerModal({
  instanceId,
  phaseId,
  heroImagePath,
  hideOnMobile = false,
}: {
  instanceId: string;
  /** When set, targets that phase's banner; otherwise the overview banner. */
  phaseId?: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
  /** Hide the button below md (overview uses the mobile admin bar instead). */
  hideOnMobile?: boolean;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const label = heroImagePath ? t('Edit banner') : t('Add banner');

  return (
    <>
      <Button
        color="secondary"
        size="small"
        className={cn(
          'absolute top-4 right-4 z-10',
          hideOnMobile && 'hidden md:flex',
        )}
        onPress={() => setIsOpen(true)}
      >
        <LuImage className="size-4" aria-hidden="true" />
        {label}
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
