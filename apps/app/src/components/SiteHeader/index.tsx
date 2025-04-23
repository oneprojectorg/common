'use client';

import { getPublicUrl } from '@/utils';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { LuSearch } from 'react-icons/lu';

import { trpc } from '@op/trpc/client';
import { Skeleton } from '@op/ui/Skeleton';
import { TextField } from '@op/ui/TextField';

import { CommonLogo } from '../CommonLogo';
import { OPLogo } from '../OPLogo';

const UserAvatarMenu = () => {
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();

  return (
    <div className="size-8 rounded-full border bg-white shadow">
      {user.avatarImage ? (
        <Image
          src={getPublicUrl(user.avatarImage.name)}
          alt="User avatar"
          width={48}
          height={48}
        />
      ) : (
        <div className="size-8 rounded-full border bg-white shadow">
          {user.name?.slice(0, 1) ?? ''}
        </div>
      )}
    </div>
  );
};

export const SiteHeader = () => {
  return (
    <header className="flex h-14 w-full items-center justify-between border-b px-4 py-7 md:px-28">
      <Link href="/" className="flex gap-1">
        <OPLogo />
        <CommonLogo />
      </Link>
      <TextField
        inputProps={{
          placeholder: 'Search',
          color: 'muted',
          size: 'small',
          icon: <LuSearch className="text-darkGray" />,
        }}
        className="w-96"
        aria-label="Search"
      />

      <ErrorBoundary
        fallback={
          <div className="size-8 rounded-full border bg-white shadow" />
        }
      >
        <Suspense
          fallback={
            <Skeleton className="size-8 rounded-full border bg-white shadow" />
          }
        >
          <UserAvatarMenu />
        </Suspense>
      </ErrorBoundary>
    </header>
  );
};
