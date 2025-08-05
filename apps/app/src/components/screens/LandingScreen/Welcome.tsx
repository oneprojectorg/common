'use client';

import { RouterOutput } from '@op/api/client';
import { Header1 } from '@op/ui/Header';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

export const Welcome = ({
  user,
}: {
  user: RouterOutput['account']['getMyAccount'];
}) => {
  const searchParams = useSearchParams();
  const t = useTranslations();

  const isNew = useMemo(() => {
    return searchParams.get('new') === '1';
  }, []);

  const orgName = user.currentProfile?.name;
  const name = orgName ? `, ${orgName}` : ` ${t('to Common')}`;

  return (
    <Header1 className="text-center text-title-md sm:text-title-xl">
      {isNew ? `${t('Welcome')}${name}!` : `${t('Welcome back')}${name}!`}
    </Header1>
  );
};
