'use client';

import { trpc } from '@op/api/client';

import { useTranslations } from '@/lib/i18n';

import { EditBannerModal } from '../EditBannerModal';

interface ProcessAdminBannerProps {
  slug: string;
  instanceId: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
}

/** The "Add banner" / "Edit banner" control on the admin hero. The page reads the hero from the query, so a change refetches instead of reloading. */
export function ProcessAdminBanner({
  slug,
  instanceId,
  heroImagePath,
}: ProcessAdminBannerProps) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();

  return (
    <EditBannerModal
      instanceId={instanceId}
      heroImagePath={heroImagePath}
      label={heroImagePath ? undefined : t('addBannerAction')}
      size="sm"
      className="z-20 flex"
      onChange={() => {
        void utils.decision.getDecisionBySlug.invalidate({ slug }, undefined, {
          cancelRefetch: false,
        });
      }}
    />
  );
}
