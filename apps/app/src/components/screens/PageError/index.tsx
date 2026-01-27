'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { match } from '@op/core';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { useEffect } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

export interface ErrorProps {
  error: Error & { digest?: string };
}

export default function PageError({ error }: ErrorProps) {
  const t = useTranslations();

  const errorData = match(error.message, {
    UNAUTHORIZED: () => ({
      code: 403,
      description: (
        <p className="text-center">
          {t('You do not have permission to view this page')}
        </p>
      ),
      actions: (
        <Button onPress={() => window.history.back()} color="primary">
          {t('Go back')}
        </Button>
      ),
    }),
    _: () => ({
      code: 500,
      description: (
        <p className="text-center">
          {t("Something went wrong on our end. We're working to fix it.")}
          <br />
          {t('Please try again in a moment')}
        </p>
      ),
      actions: (
        <Button onPress={() => window.location.reload()} color="primary">
          {t('Try again')}
        </Button>
      ),
    }),
  });

  return (
    <ClientOnly>
      <div className="flex size-full flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <Header2 className="font-serif text-[4rem] leading-[110%] font-light">
            {errorData.code}
          </Header2>
          {errorData.description}
        </div>
        {errorData.actions}
      </div>
    </ClientOnly>
  );
}
