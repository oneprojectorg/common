'use client';

import { AuthWrapper } from '@/utils/AuthWrapper';
import Link from 'next/link';

import { trpc } from '@op/trpc/client';

const MainPage = () => {
  const { data: organizations } = trpc.organization.list.useQuery();

  return (
    <AuthWrapper>
      <div className="container flex min-h-0 grow flex-col px-0 pt-4">
        {organizations?.map(org => (
          <Link href={`/app/org/${org.slug}`} key={org.id}>
            <h2>{org.name}</h2>
            <p>{org.description}</p>
          </Link>
        ))}
      </div>
    </AuthWrapper>
  );
};

export default MainPage;
