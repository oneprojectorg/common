'use client';

import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { useAuthLogout } from '@op/hooks';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem, MenuItemSimple, MenuSeparator } from '@op/ui/Menu';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Popover } from '@op/ui/Popover';
import { MenuTrigger } from '@op/ui/RAC';
import { Skeleton } from '@op/ui/Skeleton';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { LuChevronDown, LuLogOut, LuSearch } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { CommonLogo } from '../CommonLogo';
import ErrorBoundary from '../ErrorBoundary';
import { PrivacyPolicyModal } from '../PrivacyPolicyModal';
import { UpdateProfileModal } from '../Profile/ProfileDetails/UpdateProfileModal';
import { SearchInput } from '../SearchInput';
import { ToSModal } from '../ToSModal/index.tsx';

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

const AvatarMenuContent = ({ onClose }: { onClose?: () => void }) => {
  const { user } = useUser();
  const logout = useAuthLogout();
  const router = useRouter();
  const utils = trpc.useUtils();
  const t = useTranslations();
  const switchOrganization = trpc.account.switchOrganization.useMutation({
    onSuccess: () => {
      utils.account.getMyAccount.invalidate();
      utils.invalidate();
    },
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <MenuItemSimple
        isDisabled
        className="flex cursor-default items-center gap-2 p-0 px-0 pb-4 text-neutral-charcoal hover:bg-transparent"
      >
        <Avatar className="size-6" placeholder={user?.name ?? ''}>
          {user?.avatarImage?.name ? (
            <Image
              src={getPublicUrl(user?.avatarImage?.name) ?? ''}
              width={80}
              height={80}
              alt={user?.name ?? 'User avatar'}
            />
          ) : null}
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm">
            Logged in as {user?.name} (
            <Button
              onPress={() => setIsProfileOpen(true)}
              unstyled
              className=""
            >
              <span className="text-primary-teal hover:underline">
                {t('Edit Profile')}
              </span>
            </Button>
            )
          </span>

          <span className="text-xs text-neutral-gray4">
            Admin for {user?.currentOrganization?.name}
          </span>
        </div>
      </MenuItemSimple>
      {user?.organizationUsers?.map((orgUser) => (
        <MenuItem
          key={orgUser.organizationId}
          className="min-h-[60px] px-4 py-4 text-neutral-charcoal"
          onAction={() => {
            if (user.currentOrganization?.id === orgUser.organizationId) {
              router.push(`/org/${orgUser.organization?.slug}`);
              onClose?.();
              return;
            }

            void switchOrganization.mutate({
              // @ts-expect-error this is a backend issue to be resolved
              organizationId: orgUser.organization?.id,
            });
            onClose?.();
          }}
        >
          <Avatar placeholder={orgUser.organization?.name}>
            {orgUser.organization?.avatarImage?.name ? (
              <Image
                src={getPublicUrl(orgUser.organization.avatarImage.name) ?? ''}
                alt="User avatar"
                width={48}
                height={48}
              />
            ) : null}
          </Avatar>
          <div className="flex flex-col">
            <div>{orgUser.organization?.name}</div>
            <div className="text-sm text-neutral-gray4">
              {orgUser.organization?.orgType}
            </div>
          </div>
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem
        id="logout"
        className="min-h-[60px] px-4 py-4 text-neutral-charcoal"
        onAction={() => {
          void logout.refetch().finally(() => router.push('/'));
          onClose?.();
        }}
      >
        <LuLogOut className="size-8 rounded-full bg-neutral-offWhite p-2" />{' '}
        {t('Log out')}
      </MenuItem>
      <MenuItemSimple
        isDisabled
        className="flex flex-col items-start justify-start gap-2 text-sm text-neutral-gray4 hover:bg-transparent"
      >
        <div>
          <PrivacyPolicyModal />
          {' • '}
          <ToSModal />
        </div>
        <div className="text-xs">
          Ethical Open Source • One Project • {new Date().getFullYear()}
        </div>
      </MenuItemSimple>
      <UpdateProfileModal isOpen={isProfileOpen} setIsOpen={setIsProfileOpen} />
    </>
  );
};

const UserAvatarMenu = () => {
  const { user } = useUser();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const avatarButton = (
    <Button
      unstyled
      className="relative"
      onPress={() => (isMobile ? setIsDrawerOpen(true) : undefined)}
    >
      <Avatar placeholder={user?.currentOrganization?.name}>
        {user?.currentOrganization?.avatarImage?.name ? (
          <Image
            src={getPublicUrl(user?.currentOrganization.avatarImage.name) ?? ''}
            alt="User avatar"
            width={48}
            height={48}
          />
        ) : null}
      </Avatar>
      <div className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-neutral-offWhite outline -outline-offset-1 outline-white">
        <LuChevronDown className="size-3" />{' '}
      </div>
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {avatarButton}
        <Modal
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          isDismissable={true}
          isKeyboardDismissDisabled={false}
          overlayClassName="p-0 items-end justify-center animate-in fade-in-0 duration-300"
          className="m-0 w-screen max-w-none rounded-b-none rounded-t duration-300 ease-out animate-in slide-in-from-bottom-full"
        >
          <ModalBody className="pb-safe p-0">
            <Menu className="flex min-w-full flex-col p-4 pb-8">
              <AvatarMenuContent onClose={() => setIsDrawerOpen(false)} />
            </Menu>
          </ModalBody>
        </Modal>
      </>
    );
  }

  return (
    <MenuTrigger>
      {avatarButton}
      <Popover className="min-w-[150px]">
        <Menu className="flex min-w-72 flex-col p-4 pb-6">
          <AvatarMenuContent />
        </Menu>
      </Popover>
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
          <ErrorBoundary fallback={<Skeleton className="h-10 w-96" />}>
            <SearchInput />
          </ErrorBoundary>
        </span>

        <ClientOnly>
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
          </ClientOnly>
        </div>
      </header>
    </>
  );
};
