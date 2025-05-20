'use client';

import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { UserProvider, useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
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

const UserAvatarMenu = () => {
  const { user } = useUser();
  const logout = useAuthLogout();
  const utils = trpc.useUtils();
  const switchOrganization = trpc.account.switchOrganization.useMutation({
    onSuccess: () => {
      utils.account.getMyAccount.invalidate();
      utils.invalidate();
    },
  });

  return (
    <MenuTrigger>
      <Button unstyled>
        <Avatar placeholder={user?.currentOrganization?.name}>
          {user?.currentOrganization?.avatarImage?.name ? (
            <Image
              src={
                getPublicUrl(user?.currentOrganization.avatarImage.name) ?? ''
              }
              alt="User avatar"
              width={48}
              height={48}
            />
          ) : null}
        </Avatar>
      </Button>

      <Menu className="min-w-72">
        {user?.organizationUsers?.map((orgUser) => (
          <MenuItem
            onAction={() =>
              void switchOrganization.mutate({
                // @ts-expect-error this is a backend issue to be resolved
                organizationId: orgUser.organization?.id,
              })
            }
          >
            <Avatar placeholder={orgUser.organization?.name}>
              {orgUser.organization?.avatarImage?.name ? (
                <Image
                  src={
                    getPublicUrl(orgUser.organization.avatarImage.name) ?? ''
                  }
                  alt="User avatar"
                  width={48}
                  height={48}
                />
              ) : null}
            </Avatar>
            {orgUser.organization?.name}
          </MenuItem>
        ))}
        <MenuItem id="logout" onAction={() => void logout.refetch()}>
          Logout
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );
};

export const SiteHeader = () => {
  return (
    <>
      <header className="gridCentered hidden h-auto w-full items-center justify-between border-b border-offWhite px-4 py-3 sm:grid md:px-28">
        <Link href="/" className="flex gap-1">
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
      {/* Mobile */}
      <header className="flex h-auto w-full items-center justify-between border-b px-4 py-2 sm:hidden">
        <Link href="/">
          <CommonLogo />
        </Link>
        <div className="flex gap-4">
          <span className="flex items-center justify-center">
            <LuSearch className="size-4 text-neutral-gray4" />
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
        </div>
      </header>
    </>
  );
};
