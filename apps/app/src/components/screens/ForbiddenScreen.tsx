'use client';

import { Button } from '@op/sense/Button';

import { useTranslations } from '@/lib/i18n';

import { StatusScreen } from './StatusScreen';

/**
 * Walled-garden 403 screen, rendered by the `forbidden.tsx` boundary.
 */
export const ForbiddenScreen = () => {
  const t = useTranslations();

  return (
    <StatusScreen
      code={403}
      description={
        <p className="text-center">
          {t('You do not have permission to view this page')}
        </p>
      }
      actions={
        <Button onClick={() => window.history.back()}>{t('Go back')}</Button>
      }
    />
  );
};
