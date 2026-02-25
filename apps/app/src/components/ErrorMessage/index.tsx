'use client';

import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const ErrorMessage = ({ children }: { children?: ReactNode }) => {
  const t = useTranslations();
  const message = t('Something went wrong');

  return <div>{children ?? message}</div>;
};
