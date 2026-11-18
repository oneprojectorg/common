'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { match, parseErrorDigest } from '@op/core';
import { logger } from '@op/logging/client';
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
  const statusCode = statusCodeOf(error);

  useEffect(() => {
    if (statusCode >= 500) {
      posthog.captureException(error, {
        error_digest: error.digest,
      });
      return;
    }
    logger.warn('Page request rejected', {
      statusCode,
      errorDigest: error.digest,
    });
  }, [error, statusCode]);

  const errorData = match(statusCode, {
    401: () => forbidden(),
    403: () => forbidden(),
    404: () => ({
      code: 404,
      description: (
        <p className="text-center">
          {t('shell.notFoundTitle')}
          <br />
          {t('shell.notFoundBody')}
        </p>
      ),
      actions: (
        <Button onClick={() => window.location.assign('/')}>
          {t('shell.notFoundHomeAction')}
        </Button>
      ),
    }),
    _: () => ({
      code: 500,
      description: (
        <p className="text-center">
          {t('shell.errorTitle')}
          <br />
          {t('shell.errorHint')}
        </p>
      ),
      actions: (
        <Button onClick={() => window.location.reload()}>
          {t('Try again')}
        </Button>
      ),
    }),
  });

  function forbidden() {
    return {
      code: 403,
      description: <p className="text-center">{t('shell.forbiddenTitle')}</p>,
      actions: (
        <Button onClick={() => window.history.back()}>{t('Go back')}</Button>
      ),
    };
  }

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

const statusCodeOf = (error: ErrorProps['error']): number => {
  const digest = parseErrorDigest(error.digest);
  if (digest) {
    return digest.statusCode;
  }
  return error.message === 'UNAUTHORIZED' ? 403 : 500;
};
