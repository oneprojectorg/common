'use client';

import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { useAuthLogout } from '@op/hooks';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem, MenuItemSimple, MenuSeparator } from '@op/ui/Menu';
import { Modal, ModalBody, ModalHeader, ModalFooter } from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { DialogTrigger } from '@op/ui/Dialog';
import { Popover } from '@op/ui/Popover';
import { MenuTrigger } from '@op/ui/RAC';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  LuChevronDown,
  LuCircleHelp,
  LuLogOut,
  LuSearch,
  LuUserPlus,
  LuSend,
} from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { CoCModal } from '../CoCModal';
import { CommonLogo } from '../CommonLogo';
import ErrorBoundary from '../ErrorBoundary';
import { PrivacyPolicyModal } from '../PrivacyPolicyModal';
import { UpdateProfileModal } from '../Profile/ProfileDetails/UpdateProfileModal';
import { SearchInput } from '../SearchInput';
import { ToSModal } from '../ToSModal';

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

const InviteUserModal = () => {
  const [email, setEmail] = useState('');
  const t = useTranslations();

  const handleSendInvite = () => {
    console.log('Send invite to:', email);
    setEmail('');
  };

  return (
    <DialogTrigger>
      <Button
        color="primary"
        size="medium"
        className="flex items-center gap-2"
      >
        <LuUserPlus className="size-4" />
        {t('Invite')}
      </Button>
      <Modal>
        <ModalHeader>{t('Send Invitation')}</ModalHeader>
        <ModalBody>
          <TextField
            label={t('Email Address')}
            value={email}
            onChange={setEmail}
            isRequired
            description={t('Enter the email address to send an invite')}
            inputProps={{ 
              type: "email",
              placeholder: "example@email.com"
            }}
          />
        </ModalBody>
        <ModalFooter className="flex justify-end gap-2">
          <Button
            color="secondary"
            surface="outline"
            onPress={() => setEmail('')}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="primary"
            onPress={handleSendInvite}
            isDisabled={!email}
            className="flex items-center gap-2"
          >
            <LuSend className="size-4" />
            {t('Send Invite')}
          </Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>
  );
};

const AvatarMenuContent = ({
  onClose,
  setIsProfileOpen = () => {},
}: {
  onClose?: () => void;
  setIsProfileOpen?: (isOpen: boolean) => void;
}) => {
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
              fill
              className="object-cover"
              alt={user?.name ?? 'User avatar'}
            />
          ) : null}
        </Avatar>
        <div className="flex flex-col">
          <span className="sm:text-sm">
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

          <span className="text-sm text-neutral-gray4 sm:text-xs">
            Admin for {user?.currentOrganization?.profile.name}
          </span>
        </div>
      </MenuItemSimple>
      {user?.organizationUsers?.map((orgUser) => (
        <MenuItem
          key={orgUser.organizationId}
          className={cn(
            'min-h-[60px] px-4 py-4 text-neutral-charcoal',
            user.currentOrganization?.id === orgUser.organizationId &&
              'bg-neutral-offWhite',
          )}
          onAction={() => {
            if (user.currentOrganization?.id === orgUser.organizationId) {
              router.push(`/org/${orgUser.organization?.profile.slug}`);
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
          <Avatar placeholder={orgUser.organization?.profile.name}>
            {orgUser.organization?.profile.avatarImage?.name ? (
              <Image
                src={
                  getPublicUrl(orgUser.organization.profile.avatarImage.name) ??
                  ''
                }
                alt="User avatar"
                fill
                className="object-cover"
              />
            ) : null}
          </Avatar>
          <div className="flex flex-col">
            <div>{orgUser.organization?.profile.name}</div>
            <div className="text-sm capitalize text-neutral-gray4">
              {orgUser.organization?.orgType}
            </div>
          </div>
        </MenuItem>
      ))}
      <MenuSeparator className="pt-4" />
      <MenuItem
        id="help"
        className="px-0 py-2 text-neutral-charcoal hover:bg-neutral-offWhite focus:bg-neutral-offWhite"
        onAction={() => {
          router.push(
            'https://oneprojectorg.notion.site/Common-Platform-Feature-Requests-Bug-Submissions-1f3f0b6622538047a51ec4a8b335bc27',
          );

          onClose?.();
        }}
      >
        <LuCircleHelp className="size-8 rounded-full bg-neutral-offWhite p-2" />{' '}
        {t('Feature Requests & Support')}
      </MenuItem>
      <MenuItem
        id="logout"
        className="px-0 py-2 text-neutral-charcoal hover:bg-neutral-offWhite focus:bg-neutral-offWhite"
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
        className="flex flex-col items-start justify-start gap-2 px-0 pt-4 text-neutral-gray4 hover:bg-transparent sm:text-sm"
      >
        <div>
          <PrivacyPolicyModal />
          {' • '}
          <ToSModal />
          {' • '}
          <CoCModal />
        </div>
      </MenuItemSimple>
      <MenuItemSimple
        isDisabled
        className="flex flex-col items-start justify-start gap-2 px-0 text-sm text-neutral-gray4 hover:bg-transparent"
      >
        <div className="text-sm sm:text-xs">
          Ethical Open Source • One Project • {new Date().getFullYear()}
        </div>
      </MenuItemSimple>
    </>
  );
};

const UserAvatarMenu = () => {
  const { user } = useUser();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const avatarButton = (
    <Button
      unstyled
      className="relative"
      onPress={() => (isMobile ? setIsDrawerOpen(true) : undefined)}
    >
      <Avatar placeholder={user?.currentOrganization?.profile.name}>
        {user?.currentOrganization?.profile.avatarImage?.name ? (
          <Image
            src={
              getPublicUrl(
                user?.currentOrganization.profile.avatarImage.name,
              ) ?? ''
            }
            alt="User avatar"
            fill
            className="object-cover"
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
          className="m-0 w-screen max-w-none rounded-b-none rounded-t border-0 outline-0 duration-300 ease-out animate-in slide-in-from-bottom-full"
        >
          <ModalBody className="pb-safe p-0">
            <Menu className="flex min-w-full flex-col border-t-0 p-4 pb-8">
              <AvatarMenuContent
                setIsProfileOpen={setIsProfileOpen}
                onClose={() => setIsDrawerOpen(false)}
              />
            </Menu>
          </ModalBody>
        </Modal>
        <UpdateProfileModal
          isOpen={isProfileOpen}
          setIsOpen={setIsProfileOpen}
        />
      </>
    );
  }

  return (
    <>
      <MenuTrigger>
        {avatarButton}
        <Popover className="min-w-[150px]">
          <Menu className="flex min-w-72 flex-col p-4 pb-6">
            <AvatarMenuContent
              setIsProfileOpen={setIsProfileOpen}
              onClose={() => setIsProfileOpen(false)}
            />
          </Menu>
        </Popover>
      </MenuTrigger>
      <UpdateProfileModal isOpen={isProfileOpen} setIsOpen={setIsProfileOpen} />
    </>
  );
};

export const SiteHeader = () => {
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

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

        <div className="flex items-center gap-3">
          <ClientOnly>
            <InviteUserModal />
          </ClientOnly>
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

      {/* Mobile */}
      <header className="flex h-auto w-full items-center justify-between px-4 py-2 sm:hidden">
        {!isMobileSearchExpanded && (
          <Link href="/">
            <CommonLogo />
          </Link>
        )}

        <div
          className={`flex ${isMobileSearchExpanded ? 'w-full items-center justify-between' : 'gap-4'}`}
        >
          {isMobileSearchExpanded ? (
            <>
              <div className="min-w-0 flex-1">
                <ErrorBoundary fallback={<Skeleton className="h-10 w-full" />}>
                  <SearchInput
                    onBlur={() => setIsMobileSearchExpanded(false)}
                  />
                </ErrorBoundary>
              </div>
              <Button
                unstyled
                onPress={() => setIsMobileSearchExpanded(false)}
                className="ml-3 whitespace-nowrap text-neutral-gray4"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                unstyled
                onPress={() => setIsMobileSearchExpanded(true)}
                className="flex items-center justify-center"
              >
                <LuSearch className="size-4 text-neutral-gray4" />
              </Button>

              <div className="flex items-center gap-3">
                <ClientOnly>
                  <InviteUserModal />
                </ClientOnly>
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
            </>
          )}
        </div>
      </header>
    </>
  );
};
