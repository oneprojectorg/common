'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { useRequiredUser, useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { useAuthLogout, useMediaQuery } from '@op/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Dialog, DialogContent, DialogTitle } from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { SidebarTrigger } from '@op/sense/Sidebar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  LuChevronDown,
  LuCircleHelp,
  LuLogOut,
  LuSearch,
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

// TODO(sense): Figma nav redesign pending. The account menu is shared between a
// desktop DropdownMenu popover and a mobile bottom-sheet Dialog. Because base-ui
// menu items (DropdownMenuItem) require a Menu context, the shared rows are
// rendered as plain buttons/divs so the same content works inside both the
// DropdownMenuContent and the DialogContent. Revisit item semantics + the
// bottom-sheet treatment in the redesign pass.
const ProfileAvatar = ({
  name,
  imageName,
  alt,
  size,
  className,
}: {
  name?: string | null;
  imageName?: string | null;
  alt: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}) => {
  const src = imageName ? (getPublicUrl(imageName) ?? undefined) : undefined;

  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={alt} /> : null}
      <AvatarFallback name={name ?? undefined} />
    </Avatar>
  );
};

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
    <Button
      key={profile.id}
      variant="ghost"
      className={cn(
        'flex min-h-[60px] w-72 items-center justify-start gap-2 hover:bg-neutral-offWhite',
        user.currentProfile?.id === profile.id && 'bg-neutral-offWhite',
      )}
      onClick={() => {
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
      <ProfileAvatar
        name={profile.name}
        imageName={profile.avatarImage?.name}
        alt="Profile avatar"
        className="flex-shrink-0"
      />
      {children}
    </Button>
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
      <div className="flex cursor-default items-center gap-2 p-0 px-0 pb-4 text-neutral-charcoal">
        <ProfileAvatar
          name={user.name ?? ''}
          imageName={avatarUrl}
          alt={user.name ?? 'User avatar'}
          size="sm"
        />
        <div className="flex flex-col">
          <span className="sm:text-sm">
            {t('Logged in as')} <bdi>{user.profile?.name ?? user.name}</bdi> (
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="text-primary-teal hover:underline"
            >
              {t('Edit Profile')}
            </button>
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
      </div>

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
                <Badge variant="secondary">Active</Badge>
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

      {orgProfiles?.length ? <MenuDivider /> : null}
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
                <Badge variant="secondary">Active</Badge>
              ) : null}
            </div>
            <div className="relative truncate overflow-hidden text-sm text-neutral-gray4 capitalize">
              {t('Organization')}
            </div>
          </div>
        </ProfileMenuItem>
      ))}
      <MenuDivider />
      <Button
        variant="ghost"
        className="w-full justify-start px-0 py-2 text-neutral-charcoal hover:bg-neutral-offWhite focus-visible:bg-neutral-offWhite"
        onClick={() => {
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
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-start px-0 py-2 text-neutral-charcoal hover:bg-neutral-offWhite focus-visible:bg-neutral-offWhite"
        onClick={() => {
          // Full-page navigation: client-side routing would re-render the
          // authed tree with a dead session before the redirect lands.
          void logout.refetch().finally(() => window.location.assign('/'));
          onClose?.();
        }}
      >
        <LuLogOut className="size-8 rounded-full bg-neutral-offWhite p-2" />{' '}
        {t('Log out')}
      </Button>
      <div className="flex flex-col items-start justify-start gap-2 px-0 pt-4 text-neutral-gray4 sm:text-sm">
        <div>
          <PrivacyPolicyModal />
          {' • '}
          <ToSModal />
          {' • '}
          <CommunityCommitmentsModal />
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
              <button
                type="button"
                className="cursor-pointer text-neutral-charcoal hover:underline"
                onClick={() => {
                  setIsOrgDeletionOpen(true);
                  onClose?.();
                }}
              >
                {t('Delete my account')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export const UserAvatarMenu = ({ className }: { className?: string }) => {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    <button
      type="button"
      className={cn('relative', className)}
      onClick={() => (isMobile ? setIsDrawerOpen(true) : undefined)}
    >
      <ProfileAvatar
        name={user.currentProfile?.name}
        imageName={user.currentProfile?.avatarImage?.name}
        alt="User avatar"
        size="sm"
      />
      <div className="absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-neutral-offWhite outline -outline-offset-1 outline-white">
        <LuChevronDown className="size-3" />{' '}
      </div>
    </button>
  );

  if (isMobile) {
    return (
      <>
        {avatarButton}
        {/* TODO(sense): Figma nav redesign pending — the op/ui bottom-sheet
            Modal is mapped onto a centered Dialog overridden to dock to the
            bottom; the redesign pass should decide the final sheet treatment
            (possibly @op/sense/Sheet). */}
        <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DialogContent
            showCloseButton={false}
            className="top-auto bottom-0 left-0 max-h-[85svh] w-full max-w-none translate-x-0 translate-y-0 rounded-t rounded-b-none border-0 p-0"
          >
            <DialogTitle className="sr-only">{t('Open menu')}</DialogTitle>
            <div className="pb-safe flex min-w-full flex-col p-4 pb-8">
              <AvatarMenuContent
                setIsProfileOpen={setIsProfileOpen}
                setIsOrgDeletionOpen={setIsOrgDeletionOpen}
                onClose={() => setIsDrawerOpen(false)}
                onProfileSwitch={handleProfileSwitch}
              />
            </div>
          </DialogContent>
        </Dialog>
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
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger render={avatarButton} />
        <DropdownMenuContent
          side="bottom"
          align="end"
          className="flex min-w-72 flex-col p-4 pb-6"
        >
          <AvatarMenuContent
            setIsProfileOpen={setIsProfileOpen}
            setIsOrgDeletionOpen={setIsOrgDeletionOpen}
            onClose={() => setIsMenuOpen(false)}
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
      size="sm"
      className={className}
      onClick={() =>
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
            <SidebarTrigger aria-label={t('Open menu')} className="p-1" />
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
              <button
                type="button"
                onClick={() => setIsMobileSearchExpanded(false)}
                className="ms-3 whitespace-nowrap text-neutral-gray4"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsMobileSearchExpanded(true)}
                className="flex items-center justify-center"
              >
                <LuSearch className="size-4 text-neutral-gray4" />
              </button>

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

const MenuDivider = ({ className }: { className?: string }) => (
  <div className={cn('mt-4 h-px w-full bg-neutral-gray1', className)} />
);
