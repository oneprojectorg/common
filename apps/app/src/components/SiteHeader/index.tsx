'use client';

import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { UserProvider, useUser } from '@/utils/UserProvider';
import { useAuthLogout } from '@op/hooks';
import { Avatar } from '@op/ui/Avatar';
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
  const { user } = useUser();
  const logout = useAuthLogout();

  return (
    <Avatar>
      <MenuTrigger>
        <Button unstyled>
          {user?.currentOrganization?.avatarImage?.name ? (
            <Image
              src={
                getPublicUrl(user?.currentOrganization.avatarImage.name) ?? ''
              }
              alt="User avatar"
              width={48}
              height={48}
            />
          ) : (
            <div className="flex size-8 items-center justify-center text-neutral-gray3">
              {user?.currentOrganization?.name?.slice(0, 1) ?? ''}
            </div>
          )}
        </Button>

        <Menu>
          <MenuItem id="logout" onAction={() => void logout.refetch()}>
            Logout
          </MenuItem>
        </Menu>
      </MenuTrigger>
    </Avatar>
  );
};

export const SiteHeader = () => {
  return (
    <>
      <header className="gridCentered hidden h-auto w-full items-center justify-between border-b border-offWhite px-4 py-3 sm:grid md:px-28">
        <Link href="/" className="flex gap-1">
          <OPLogo />
          <CommonLogo />
        </Link>
        <span className="flex items-center justify-center">
          <TextField
            inputProps={{
              placeholder: 'Search',
              color: 'muted',
              size: 'small',
              icon: <LuSearch className="size-4 text-neutral-gray4" />,
            }}
            className="w-96"
            aria-label="Search"
          />
        </span>

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
              <UserProvider>
                <UserAvatarMenu />
              </UserProvider>
            </Suspense>
          </ErrorBoundary>
        </ClientOnly>
      </header>
    </>
  );
};
