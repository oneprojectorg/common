'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { match } from '@op/core';
import { Button } from '@op/sense/Button';
import posthog from 'posthog-js';
import { useEffect } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { StatusScreen } from '../StatusScreen';

export interface ErrorProps {
  error: Error & { digest?: string };
}

export default function PageError({ error }: ErrorProps) {
  const t = useTranslations();

  useEffect(() => {
    posthog.captureException(error, {
      error_digest: error.digest,
    });
  }, [error]);

  const errorData = match(error.message, {
    UNAUTHORIZED: () => ({
      code: 403,
      description: (
        <p className="text-center">
          {t('You do not have permission to view this page')}
        </p>
      ),
      actions: (
        <Button onClick={() => window.history.back()}>{t('Go back')}</Button>
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
        <Button onClick={() => window.location.reload()}>
          {t('Try again')}
        </Button>
      ),
    }),
  });

  return (
    <ClientOnly>
      <StatusScreen
        code={errorData.code}
        description={errorData.description}
        actions={errorData.actions}
      />
    </ClientOnly>
  );
}
