'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { OverviewHeroImageField } from '../OverviewHeroImageField';

interface ProcessAdminBannerProps {
  slug: string;
  instanceId: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
}

/** The "Add banner" / "Edit banner" control in the hero's top end corner, and its upload dialog. */
export function ProcessAdminBanner({
  slug,
  instanceId,
  heroImagePath,
}: ProcessAdminBannerProps) {
  const t = useTranslations('decisions');
  const tShared = useTranslations();
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const label = heroImagePath
    ? t('processBuilder.editBannerTitle')
    : t('processAdmin.addBannerAction');

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="absolute end-4 top-4 z-20"
        onClick={() => setIsOpen(true)}
      >
        <LuImage className="size-4" aria-hidden />
        {label}
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('processBuilder.editBannerTitle')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <OverviewHeroImageField
              instanceId={instanceId}
              initialPath={heroImagePath}
              onChange={() => {
                void utils.decision.getDecisionBySlug.invalidate({ slug });
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {tShared('Done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
