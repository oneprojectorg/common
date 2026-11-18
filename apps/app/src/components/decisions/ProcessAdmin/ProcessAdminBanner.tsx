'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { BannerUploadModal } from '../BannerUploadModal';

interface ProcessAdminBannerProps {
  slug: string;
  instanceId: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
}

/** The "Add banner" / "Edit banner" control in the hero's top end corner. The page reads the hero from the query, so a change refetches instead of reloading. */
export function ProcessAdminBanner({
  slug,
  instanceId,
  heroImagePath,
}: ProcessAdminBannerProps) {
  const t = useTranslations('decisions');
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
      <BannerUploadModal
        instanceId={instanceId}
        heroImagePath={heroImagePath}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onChange={() => {
          void utils.decision.getDecisionBySlug.invalidate({ slug });
        }}
      />
    </>
  );
}
