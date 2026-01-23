'use client';

import { Button } from '@op/ui/Button';
import type { ReactNode } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export const ErrorState = ({
  message,
  icon,
}: {
  message: ReactNode;
  icon?: ReactNode;
}) => {
  return (
    <div className="flex min-h-40 w-full flex-col items-center justify-center py-6">
      <div className="flex flex-col items-center justify-center gap-3 text-neutral-gray4">
        <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
          {icon ?? <LuCircleAlert />}
        </div>
        <span>{message}</span>
      </div>
    </div>
  );
};

export const ErrorStateWithRetry = ({
  message,
  icon,
  onRetry,
  retryLabel,
}: {
  message: ReactNode;
  icon?: ReactNode;
  onRetry: () => void;
  retryLabel?: string;
}) => {
  const t = useTranslations();
  return (
    <div className="flex min-h-40 w-full flex-col items-center justify-center py-6">
      <div className="flex flex-col items-center justify-center gap-3 text-neutral-gray4">
        <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
          {icon ?? <LuCircleAlert />}
        </div>
        <span>{message}</span>
        <Button onPress={onRetry} color="secondary" size="small">
          {retryLabel ?? t('Try again')}
        </Button>
      </div>
    </div>
  );
};
