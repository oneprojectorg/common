'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { useRequiredUser, useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { useAuthLogout, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Chip } from '@op/ui/Chip';
import {
  Menu,
  MenuItem,
  MenuItemSimple,
  MenuList,
  MenuSeparator,
  MenuTrigger,
} from '@op/ui/Menu';
import { Modal, ModalBody } from '@op/ui/Modal';
import { SidebarTrigger } from '@op/ui/Sidebar';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  LuChevronDown,
  LuCircleHelp,
  LuLogOut,
  LuSearch,
  LuX,
} from 'react-icons/lu';

import { Link, useRouter, useTranslations } from '@/lib/i18n';

import { CommonLogo } from '../CommonLogo';
import { CommunityCommitmentsModal } from '../CommunityCommitmentsModal';
import { DeleteOrganizationModal } from '../DeleteOrganizationModal';
import ErrorBoundary from '../ErrorBoundary';
import { LocaleChooser } from '../LocaleChooser';
import { PrivacyPolicyModal } from '../PrivacyPolicyModal';
import { UpdateProfileModal } from '../Profile/ProfileDetails/UpdateProfile';
import { ProfileSwitchingModal } from '../ProfileSwitchingModal';
import { SearchInput } from '../SearchInput';
import { ToSModal } from '../ToSModal';
import { CreateMenu } from './CreateMenu';

const ProfileMenuItem = ({
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
  const { user } = useRequiredUser();
  const router = useRouter();
  const utils = trpc.useUtils();
  const switchProfile = trpc.account.switchProfile.useMutation({
    onSuccess: () => {
      utils.invalidate();
      // TODO: something is happening when switching so trying this out to see if it helps to continue debugging
      utils.organization.listAllPosts.refetch();
      // Reset all SSR fetches as well
      router.refresh();
    },
  });
  return (
    <MenuItem
      key={profile.id}
      className="min-h-[60px] w-72"
      selected={user.currentProfile?.id === profile.id}
      onAction={() => {
        if (user.currentProfile?.id === profile.id) {
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
    </MenuItem>
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
  const { user } = useRequiredUser();
  const logout = useAuthLogout();
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
          // TODO: typing here needs to be fixed. Will be easier with new profile types
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
      <MenuItemSimple
        isDisabled
        className="flex cursor-default items-center gap-2 p-0 px-0 pb-4 text-neutral-charcoal hover:bg-transparent"
      >
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
            {t('Logged in as')} <bdi>{user.profile?.name ?? user.name}</bdi> (
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
                <bdi>
                  {user.currentProfile?.name ??
                    user.currentOrganization?.profile.name}
                </bdi>
              </>
            ) : (
              (user.currentProfile?.bio ?? '')
            )}
          </span>
        </div>
      </MenuItemSimple>

      {userProfiles?.map((profile) => (
        <ProfileMenuItem
          key={profile.id}
          profile={profile}
          onClose={onClose}
          onProfileSwitch={onProfileSwitch}
        >
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-1">
              <span className="truncate overflow-hidden">
                <bdi>{profile.name}</bdi>{' '}
              </span>
              {user.currentProfile?.id === profile.id ? (
                <Chip>Active</Chip>
              ) : null}
            </div>
            <div
              dir="auto"
              className="relative truncate overflow-hidden text-sm text-neutral-gray4"
            >
              {profile.bio}
            </div>
          </div>
        </ProfileMenuItem>
      ))}

      {orgProfiles?.length ? <MenuSeparator className="pt-4" /> : null}
      {orgProfiles?.map((profile) => (
        <ProfileMenuItem
          key={profile.id}
          profile={profile}
          onClose={onClose}
          onProfileSwitch={onProfileSwitch}
        >
          <div className="flex flex-col overflow-hidden">
            <div className="relative flex items-center gap-1">
              <span className="truncate overflow-hidden">
                <bdi>{profile.name}</bdi>{' '}
              </span>
              {user.currentProfile?.id === profile.id ? (
                <Chip>Active</Chip>
              ) : null}
            </div>
            <div className="relative truncate overflow-hidden text-sm text-neutral-gray4 capitalize">
              {t('Organization')}
            </div>
          </div>
        </ProfileMenuItem>
      ))}
      <MenuSeparator className="pt-4" />
      <MenuItem
        id="help"
        className="px-0 py-2 text-neutral-charcoal hover:bg-neutral-offWhite focus-visible:bg-neutral-offWhite"
        onAction={() => {
          window.open(
            'https://oneprojectorg.notion.site/Common-Support-Hub-a9ef0b6622538269927c01e51045638b',
            '_blank',
            'noopener,noreferrer',
          );

          onClose?.();
        }}
      >
        <LuCircleHelp className="size-8 rounded-full bg-neutral-offWhite p-2" />{' '}
        {t('Feature Requests & Support')}
      </MenuItem>
      <MenuItem
        id="logout"
        className="px-0 py-2 text-neutral-charcoal hover:bg-neutral-offWhite focus-visible:bg-neutral-offWhite"
        onAction={() => {
          // Full-page navigation: client-side routing would re-render the
          // authed tree with a dead session before the redirect lands.
          void logout.refetch().finally(() => window.location.assign('/'));
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
          <CommunityCommitmentsModal />
        </div>
      </MenuItemSimple>
      <MenuItemSimple
        isDisabled
        className="flex flex-col items-start justify-start gap-2 px-0 text-sm text-neutral-gray4 hover:bg-transparent"
      >
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
      </MenuItemSimple>
    </>
  );
};

export const UserAvatarMenu = ({ className }: { className?: string }) => {
  const t = useTranslations();
  const { user } = useRequiredUser();
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
      <div className="absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-neutral-offWhite outline -outline-offset-1 outline-white">
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
            <div className="flex justify-end px-4 pt-3">
              <button
                type="button"
                aria-label={t('Close')}
                onClick={() => setIsDrawerOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-neutral-gray1 focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2"
              >
                <LuX className="size-4" />
              </button>
            </div>
            <MenuList className="flex min-w-full flex-col border-t-0 p-4 pt-0 pb-8">
              <AvatarMenuContent
                setIsProfileOpen={setIsProfileOpen}
                setIsOrgDeletionOpen={setIsOrgDeletionOpen}
                onClose={() => setIsDrawerOpen(false)}
                onProfileSwitch={handleProfileSwitch}
              />
            </MenuList>
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
      <MenuTrigger>
        {avatarButton}
        <Menu
          className="flex min-w-72 flex-col p-4 pb-6"
          popoverClassName="min-w-[150px]"
          placement="bottom end"
        >
          <AvatarMenuContent
            setIsProfileOpen={setIsProfileOpen}
            setIsOrgDeletionOpen={setIsOrgDeletionOpen}
            onClose={() => setIsProfileOpen(false)}
            onProfileSwitch={handleProfileSwitch}
          />
        </Menu>
      </MenuTrigger>
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

/**
 * Account control for headers on public surfaces: signed-in, non-anonymous
 * users get the avatar menu; logged-out visitors and anonymous accounts get a
 * "Log in" button instead (they have no account menu to show).
 */
export const HeaderUserMenu = ({ className }: { className?: string }) => {
  const t = useTranslations();
  const { user } = useUser();

  if (user && !user.isAnonymous) {
    return <UserAvatarMenu className={className} />;
  }

  return (
    // Native nav: /login is outside the [locale] tree, so a RAC link 404s at /en/login.
    <Button
      color="primary"
      size="small"
      className={className}
      onPress={() =>
        window.location.assign(
          `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        )
      }
    >
      {t('Log in')}
    </Button>
  );
};

/**
 * Right-side header actions. Creating and the account menu are authed
 * features; signed-out visitors only get the locale chooser.
 */
const HeaderActions = () => {
  const { user } = useUser();

  return (
    <ClientOnly>
      {user && <CreateMenu />}
      <LocaleChooser />
      {user && (
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
      )}
    </ClientOnly>
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
          <Link href="/" className="flex gap-1" aria-label={t('Home')}>
            <CommonLogo />
          </Link>
        </div>
        <span className="flex items-center justify-center">
          <ErrorBoundary fallback={<Skeleton className="h-10 w-96" />}>
            <SearchInput />
          </ErrorBoundary>
        </span>
        <div className="flex items-center gap-3">
          <HeaderActions />
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
            <Link href="/" className="flex gap-1" aria-label={t('Home')}>
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
                className="ms-3 whitespace-nowrap text-neutral-gray4"
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
                <HeaderActions />
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
};
