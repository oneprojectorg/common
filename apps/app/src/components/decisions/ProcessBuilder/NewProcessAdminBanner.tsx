'use client';

import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
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
      className="rounded-none border-x-0 border-t-0"
    >
      <LuWandSparkles />
      <AlertTitle className="flex items-center gap-2">
        {t('decisions.processAdmin.bannerTitle')}
        <Badge variant="accent">{t('Alpha')}</Badge>
      </AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        {t('decisions.processAdmin.bannerDescription')}
        <ButtonLink href={`/decisions/${slug}/manage`} size="sm">
          {t('decisions.processAdmin.bannerAction')}
        </ButtonLink>
      </AlertDescription>
    </Alert>
  );
}
