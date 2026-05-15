'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { useAuthLogout, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Avatar } from '@op/ui-next/Avatar';
import { Button } from '@op/ui-next/Button';
import { Chip } from '@op/ui-next/Chip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@op/ui-next/Menu';
import { Modal, ModalBody } from '@op/ui-next/Modal';
import { Skeleton } from '@op/ui-next/Skeleton';
import { cn } from '@op/ui-next/lib/utils';
import { SidebarTrigger } from '@op/ui/Sidebar';
import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  LuChevronDown,
  LuCircleHelp,
  LuLogOut,
  LuSearch,
} from 'react-icons/lu';

import { Link, useRouter, useTranslations } from '@/lib/i18n';

import { CoCModal } from '../CoCModal';
import { CommonLogo } from '../CommonLogo';
import { DeleteOrganizationModal } from '../DeleteOrganizationModal';
import ErrorBoundary from '../ErrorBoundary';
import { LocaleChooser } from '../LocaleChooser';
import { PrivacyPolicyModal } from '../PrivacyPolicyModal';
import { UpdateProfileModal } from '../Profile/ProfileDetails/UpdateProfile';
import { ProfileSwitchingModal } from '../ProfileSwitchingModal';
import { SearchInput } from '../SearchInput';
import { ToSModal } from '../ToSModal';
import { CreateMenu } from './CreateMenu';

const menuRowClass =
  'flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-neutral-offWhite focus-visible:bg-neutral-offWhite outline-none';

const ProfileMenuRow = ({
  profile,
  onClose,
  onProfileSwitch,
  children,
}: {
  profile: Profile;
  onClose?: () => void;
  onProfileSwitch?: (profile: {
    name: string;
    avatarImage?: { name: string } | null;
  }) => void;
  children?: React.ReactNode;
}) => {
  const { user } = useUser();
  const router = useRouter();
  const utils = trpc.useUtils();
  const switchProfile = trpc.account.switchProfile.useMutation({
    onSuccess: () => {
      utils.invalidate();
      utils.organization.listAllPosts.refetch();
      router.refresh();
    },
  });
  const isActive = user.currentProfile?.id === profile.id;
  return (
    <button
      type="button"
      className={cn(menuRowClass, 'min-h-[60px]')}
      onClick={() => {
        if (isActive) {
          const profilePath =
            profile.type === EntityType.INDIVIDUAL
              ? `/profile/${profile.slug}`
              : `/org/${profile.slug}`;
          router.push(profilePath);
          onClose?.();
          return;
        }

        onProfileSwitch?.({
          name: profile.name,
          avatarImage: profile.avatarImage,
        });
        onClose?.();

        void switchProfile.mutate({
          profileId: profile.id,
        });
      }}
    >
      <Avatar placeholder={profile.name} className="flex-shrink-0">
        {profile.avatarImage?.name ? (
          <Image
            src={getPublicUrl(profile.avatarImage.name) ?? ''}
            alt="Profile avatar"
            fill
            className="aspect-square object-cover"
          />
        ) : null}
      </Avatar>
      {children}
    </button>
  );
};

const AvatarMenuContent = ({
  onClose,
  onProfileSwitch,
  setIsProfileOpen,
  setIsOrgDeletionOpen,
}: {
  onClose?: () => void;
  setIsProfileOpen: (isOpen: boolean) => void;
  setIsOrgDeletionOpen: (isOpen: boolean) => void;
  onProfileSwitch?: (profile: {
    name: string;
    avatarImage?: { name: string } | null;
  }) => void;
}) => {
  const { user } = useUser();
  const logout = useAuthLogout();
  const router = useRouter();
  const t = useTranslations();

  const { data: profiles } = trpc.account.getUserProfiles.useQuery();

  const { userProfiles, orgProfiles } =
    profiles?.reduce<{
      userProfiles: Profile[];
      orgProfiles: Profile[];
    }>(
      (acc, profile) => {
        if (!profile) {
          return acc;
        }

        if (profile.type === EntityType.INDIVIDUAL) {
          acc.userProfiles.push(profile as Profile);
        } else {
          acc.orgProfiles.push(profile as Profile);
        }

        return acc;
      },
      {
        userProfiles: [],
        orgProfiles: [],
      },
    ) ?? {};

  const avatarUrl = user.profile?.avatarImage?.name || user.avatarImage?.name;

  const deleteOrganizationEnabled = useFeatureFlag('delete_organization');

  return (
    <>
      <div className="flex items-center gap-2 p-0 px-0 pb-4 text-neutral-charcoal">
        <Avatar className="size-6" placeholder={user.name ?? ''}>
          {avatarUrl ? (
            <Image
              src={getPublicUrl(avatarUrl) ?? ''}
              fill
              className="object-cover"
              alt={user.name ?? 'User avatar'}
            />
          ) : null}
        </Avatar>
        <div className="flex flex-col">
          <span className="sm:text-sm">
            {t('Logged in as')} {user.profile?.name ?? user.name} (
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
          <span className="max-w-72 text-sm text-neutral-gray4 sm:text-xs">
            {user.currentOrganization ? (
              <>
                {t('Admin for')}{' '}
                {user.currentProfile?.name ??
                  user.currentOrganization?.profile.name}
              </>
            ) : (
              (user.currentProfile?.bio ?? '')
            )}
          </span>
        </div>
      </div>

      {userProfiles?.map((profile) => (
        <ProfileMenuRow
          key={profile.id}
          profile={profile}
          onClose={onClose}
          onProfileSwitch={onProfileSwitch}
        >
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-1">
              <span className="truncate overflow-hidden">{profile.name} </span>
              {user.currentProfile?.id === profile.id ? (
                <Chip>Active</Chip>
              ) : null}
            </div>
            <div className="relative truncate overflow-hidden text-sm text-neutral-gray4">
              {profile.bio}
            </div>
          </div>
        </ProfileMenuRow>
      ))}

      {orgProfiles?.length ? (
        <hr className="my-2 border-t border-neutral-gray1" />
      ) : null}
      {orgProfiles?.map((profile) => (
        <ProfileMenuRow
          key={profile.id}
          profile={profile}
          onClose={onClose}
          onProfileSwitch={onProfileSwitch}
        >
          <div className="flex flex-col overflow-hidden">
            <div className="relative flex items-center gap-1">
              <span className="truncate overflow-hidden">{profile.name} </span>
              {user.currentProfile?.id === profile.id ? (
                <Chip>Active</Chip>
              ) : null}
            </div>
            <div className="relative truncate overflow-hidden text-sm text-neutral-gray4 capitalize">
              {t('Organization')}
            </div>
          </div>
        </ProfileMenuRow>
      ))}
      <hr className="my-2 border-t border-neutral-gray1" />
      <button
        type="button"
        className={cn(menuRowClass, 'px-0 py-2 text-neutral-charcoal')}
        onClick={() => {
          window.open(
            'https://harmonious-peridot-9d5.notion.site/Common-Platform-Feature-Requests-Bug-Submissions-21fa0d01a6d981f48c9cd48a4a63267e',
            '_blank',
            'noopener,noreferrer',
          );

          onClose?.();
        }}
      >
        <LuCircleHelp className="size-8 rounded-full bg-neutral-offWhite p-2" />{' '}
        {t('Feature Requests & Support')}
      </button>
      <button
        type="button"
        className={cn(menuRowClass, 'px-0 py-2 text-neutral-charcoal')}
        onClick={() => {
          void logout.refetch().finally(() => router.push('/'));
          onClose?.();
        }}
      >
        <LuLogOut className="size-8 rounded-full bg-neutral-offWhite p-2" />{' '}
        {t('Log out')}
      </button>
      <div className="flex flex-col items-start justify-start gap-2 px-0 pt-4 text-neutral-gray4 sm:text-sm">
        <div>
          <PrivacyPolicyModal />
          {' • '}
          <ToSModal />
          {' • '}
          <CoCModal />
        </div>
      </div>
      <div className="flex flex-col items-start justify-start gap-2 px-0 text-sm text-neutral-gray4">
        <div className="text-xs">
          <span
            className="pointer text-primary-teal hover:underline"
            onClick={() => {
              window.open(
                'https://github.com/oneprojectorg/common',
                '_blank',
                'noopener,noreferrer',
              );

              onClose?.();
            }}
          >
            {t('Ethical Open Source')}
          </span>{' '}
          • One Project • {new Date().getFullYear()}
          {deleteOrganizationEnabled && (
            <>
              {' • '}
              <Button
                unstyled
                className="cursor-pointer text-neutral-charcoal hover:underline"
                onPress={() => {
                  setIsOrgDeletionOpen(true);
                  onClose?.();
                }}
              >
                {t('Delete my account')}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export const UserAvatarMenu = ({ className }: { className?: string }) => {
  const { user } = useUser();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOrgDeletionOpen, setIsOrgDeletionOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const [switchingToProfile, setSwitchingToProfile] = useState<{
    name: string;
    avatarImage?: { name: string } | null;
  } | null>(null);
  const previousProfileId = useRef<string | undefined>(user.currentProfile?.id);

  const handleProfileSwitch = (profile: {
    name: string;
    avatarImage?: { name: string } | null;
  }) => {
    setSwitchingToProfile(profile);
    setIsSwitchingProfile(true);
  };

  const deleteOrganizationEnabled = useFeatureFlag('delete_organization');

  // Hide modal when profile actually changes
  useEffect(() => {
    if (
      isSwitchingProfile &&
      user.currentProfile?.id &&
      previousProfileId.current &&
      user.currentProfile.id !== previousProfileId.current
    ) {
      setIsSwitchingProfile(false);
      setSwitchingToProfile(null);
    }
    previousProfileId.current = user.currentProfile?.id;
  }, [user.currentProfile?.id, isSwitchingProfile]);

  const avatarButton = (
    <Button
      unstyled
      className={cn('relative', className)}
      onPress={() => (isMobile ? setIsDrawerOpen(true) : undefined)}
    >
      <Avatar placeholder={user.currentProfile?.name} size="sm">
        {user.currentProfile?.avatarImage?.name ? (
          <Image
            src={getPublicUrl(user.currentProfile?.avatarImage.name) ?? ''}
            alt="User avatar"
            fill
            className="object-cover"
          />
        ) : null}
      </Avatar>
      <div className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-neutral-offWhite outline -outline-offset-1 outline-white">
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
          overlayClassName="animate-in items-end justify-center p-0 duration-300 fade-in-0"
          className="m-0 h-auto w-screen max-w-none animate-in rounded-t rounded-b-none border-0 outline-0 duration-300 ease-out slide-in-from-bottom-full"
        >
          <ModalBody className="pb-safe p-0">
            <div className="flex min-w-full flex-col p-4 pb-8">
              <AvatarMenuContent
                setIsProfileOpen={setIsProfileOpen}
                setIsOrgDeletionOpen={setIsOrgDeletionOpen}
                onClose={() => setIsDrawerOpen(false)}
                onProfileSwitch={handleProfileSwitch}
              />
            </div>
          </ModalBody>
        </Modal>
        <UpdateProfileModal
          isOpen={isProfileOpen}
          setIsOpen={setIsProfileOpen}
        />
        <ProfileSwitchingModal
          isOpen={isSwitchingProfile}
          avatarImage={switchingToProfile?.avatarImage}
          profileName={switchingToProfile?.name}
          onOpenChange={setIsSwitchingProfile}
        />
        {deleteOrganizationEnabled && (
          <DeleteOrganizationModal
            isOpen={isOrgDeletionOpen}
            onOpenChange={setIsOrgDeletionOpen}
          />
        )}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={avatarButton} />
        <DropdownMenuContent
          align="end"
          className="flex w-72 flex-col p-4 pb-6"
        >
          <AvatarMenuContent
            setIsProfileOpen={setIsProfileOpen}
            setIsOrgDeletionOpen={setIsOrgDeletionOpen}
            onClose={() => setIsProfileOpen(false)}
            onProfileSwitch={handleProfileSwitch}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <UpdateProfileModal isOpen={isProfileOpen} setIsOpen={setIsProfileOpen} />
      <ProfileSwitchingModal
        isOpen={isSwitchingProfile}
        avatarImage={switchingToProfile?.avatarImage}
        profileName={switchingToProfile?.name}
        onOpenChange={setIsSwitchingProfile}
      />
      {deleteOrganizationEnabled && (
        <DeleteOrganizationModal
          isOpen={isOrgDeletionOpen}
          onOpenChange={setIsOrgDeletionOpen}
        />
      )}
    </>
  );
};

export const SiteHeader = () => {
  const t = useTranslations();
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  return (
    <>
      <header className="gridCentered hidden h-auto w-full items-center justify-between border-b border-offWhite px-4 py-3 sm:grid">
        <div className="flex items-center gap-3">
          <SidebarTrigger aria-label={t('Open menu')} />
          <Link href="/" className="flex gap-1">
            <CommonLogo />
          </Link>
        </div>
        <span className="flex items-center justify-center">
          <ErrorBoundary fallback={<Skeleton className="h-10 w-96" />}>
            <SearchInput />
          </ErrorBoundary>
        </span>
        <div className="flex items-center gap-3">
          <ClientOnly>
            <CreateMenu />
            <LocaleChooser />
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
          <div className="flex items-center gap-3">
            <SidebarTrigger
              aria-label={t('Open menu')}
              className="p-1"
              size="small"
            />
            <Link href="/" className="flex gap-1">
              <CommonLogo />
            </Link>
          </div>
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
                  <CreateMenu />
                  <LocaleChooser />
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
