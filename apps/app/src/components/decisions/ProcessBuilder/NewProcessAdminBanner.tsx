'use client';

import { Alert, AlertTitle } from '@op/sense/Alert';
import { Badge } from '@op/sense/Badge';
import { LuWandSparkles } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

export function NewProcessAdminBanner({ slug }: { slug: string }) {
  const t = useTranslations();

  return (
    <Alert
      variant="info"
      role={undefined}
      className="rounded-none border-x-0 border-t-0 bg-teal-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AlertTitle className="flex items-center gap-2">
          <LuWandSparkles className="size-4" />
          {t('decisions.processAdmin.bannerTitle')}
          <Badge variant="accent">{t('Alpha')}</Badge>
        </AlertTitle>
        <ButtonLink href={`/decisions/${slug}/manage`} size="sm">
          {t('decisions.processAdmin.bannerAction')}
        </ButtonLink>
      </div>
    </Alert>
  );
}
