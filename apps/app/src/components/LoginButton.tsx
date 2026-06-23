'use client';

import { Button } from '@op/ui/Button';

import { useTranslations } from '@/lib/i18n';

/**
 * Login button using a full navigation. `/login` lives outside the `[locale]`
 * tree, so a RAC link would 404 at `/en/login` — use `window.location` instead.
 */
export const LoginButton = ({ className }: { className?: string }) => {
  const t = useTranslations();

  return (
    <Button
      color="primary"
      size="small"
      className={className}
      onPress={() => window.location.assign('/login')}
    >
      {t('Log in')}
    </Button>
  );
};
