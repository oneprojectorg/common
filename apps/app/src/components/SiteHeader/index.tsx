'use client';

import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { useAuthLogout } from '@op/hooks';
import { trpc } from '@op/trpc/client';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem } from '@op/ui/Menu';
import { MenuTrigger } from '@op/ui/RAC';
import { Skeleton } from '@op/ui/Skeleton';
import { TextField } from '@op/ui/TextField';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import Image from 'next/image';
import { Suspense } from 'react';
import { LuSearch } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { CommonLogo } from '../CommonLogo';
import { OPLogo } from '../OPLogo';

const UserAvatarMenu = () => {
  const [user] = trpc.account.getMyAccount.useSuspenseQuery();
  const logout = useAuthLogout();

  return (
    <div className="size-8 overflow-hidden text-clip rounded-full border bg-white shadow">
      <MenuTrigger>
        <Button unstyled>
          {user.avatarImage?.name ? (
            <Image
              src={getPublicUrl(user.avatarImage.name) ?? ''}
              alt="User avatar"
              width={48}
              height={48}
            />
          ) : (
            <div className="flex size-8 items-center justify-center text-neutral-gray3">
              {user.name?.slice(0, 1) ?? ''}
            </div>
          )}
        </Button>

        <Menu>
          <MenuItem id="logout" onAction={() => void logout.refetch()}>
            Logout
          </MenuItem>
        </Menu>
      </MenuTrigger>
    </div>
  );
};

export const SiteHeader = () => {
  return (
    <header className="hidden h-14 w-full items-center justify-between border-b px-4 py-7 sm:flex md:px-28">
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

      <ClientOnly>
        <ErrorBoundary
          errorComponent={() => (
            <div className="size-8 rounded-full border bg-white shadow" />
          )}
        >
          <Suspense
            fallback={
              <Skeleton className="size-8 rounded-full border bg-white shadow" />
            }
          >
            <UserAvatarMenu />
          </Suspense>
        </ErrorBoundary>
      </ClientOnly>
    </header>
  );
};
