'use client';

import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

/**
 * Walled-garden 403 screen, rendered by the `forbidden.tsx` boundary.
 */
export const ForbiddenScreen = () => {
  const t = useTranslations();

  return (
    <div className="flex size-full flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <Header2 className="font-serif text-[4rem] leading-[110%] font-light">
          403
        </Header2>
        <p className="text-center">
          {t('You do not have permission to view this page')}
        </p>
      </div>
      <Button color="primary" onPress={() => window.history.back()}>
        {t('Go back')}
      </Button>
    </div>
  );
};
