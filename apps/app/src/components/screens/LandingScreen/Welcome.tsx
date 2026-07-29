'use client';

import type { CommonUser } from '@op/api/encoders';
import { Header1 } from '@op/sense/Header';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export const Welcome = ({ user }: { user: CommonUser }) => {
  const searchParams = useSearchParams();
  const t = useTranslations();

  const isNew = useMemo(() => {
    return searchParams.get('new') === '1';
  }, []);

  const orgName = user.currentProfile?.name;
  const name = orgName ? `, ${orgName}` : t(' to Common');

  return (
    <Header1
      data-testid="welcome-heading"
      className="text-center text-title-md sm:text-title-xl"
    >
      {isNew ? `${t('Welcome')}${name}!` : `${t('Welcome back')}${name}!`}
    </Header1>
  );
};
