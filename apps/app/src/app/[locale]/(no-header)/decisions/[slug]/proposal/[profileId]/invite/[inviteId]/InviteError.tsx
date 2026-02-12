'use client';

import { ButtonLink } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

export const InviteError = () => {
  const t = useTranslations();

  return (
    <EmptyState icon={<LuCircleAlert />}>
      <p>{t('This invite is no longer valid')}</p>
      <ButtonLink href="/">{t('Go back to home')}</ButtonLink>
    </EmptyState>
  );
};
