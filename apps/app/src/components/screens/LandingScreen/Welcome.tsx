'use client';

import { RouterOutput } from '@op/api/client';
import { Header1 } from '@op/ui/Header';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export const Welcome = ({
  user,
}: {
  user: RouterOutput['account']['getMyAccount'];
}) => {
  const searchParams = useSearchParams();

  const isNew = useMemo(() => {
    return searchParams.get('new') === '1';
  }, []);

  const orgName = user.currentOrganization?.profile.name;
  const name = orgName ? `, ${orgName}` : ` to Common`;

  return (
    <Header1 className="text-center text-title-md sm:text-title-xl">
      {isNew ? `Welcome${name}!` : `Welcome back${name}!`}
    </Header1>
  );
};
