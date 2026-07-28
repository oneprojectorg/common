'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getPublicUrl } from '@/utils';
import { ClientOnly } from '@/utils/ClientOnly';
import { useRequiredUser, useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { useAuthLogout, useMediaQuery } from '@op/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import { Dialog, DialogContent, DialogTitle } from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Separator } from '@op/sense/Separator';
import { SidebarTrigger } from '@op/sense/Sidebar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  LuChevronDown,
  LuChevronRight,
  LuCircleHelp,
  LuLogOut,
  LuPencil,
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

const ProfileMenuRow = ({
  profile,
  description,
  isEditable = false,
  onEdit,
  onClose,
  onProfileSwitch,
}: {
  profile: Profile;
  description?: string;
  isEditable?: boolean;
  onEdit?: () => void;
  onClose?: () => void;
  onProfileSwitch?: (profile: {
    name: string;
    avatarImage?: { name: string } | null;
  }) => void;
}) => {
  const t = useTranslations();
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
  const isCurrent = user.currentProfile?.id === profile.id;

  const handleSelect = () => {
    if (isCurrent) {
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
  };

  return (
    <div
      className={cn(
        'group/row flex items-center gap-4 rounded-lg border p-4',
        isCurrent ? 'border-accent-foreground bg-accent' : 'border-border',
      )}
    >
      <Button
        variant="ghost"
        onClick={handleSelect}
        className="h-auto min-w-0 flex-1 justify-start p-0 hover:bg-transparent"
      >
        <ProfileItem
          className="w-full"
          avatar={
            <ProfileAvatar
              name={profile.name}
              imageName={profile.avatarImage?.name}
              alt={profile.name}
              size="lg"
              className="flex-shrink-0"
            />
          }
          title={profile.name}
          description={description}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="flex-shrink-0"
        aria-label={isEditable ? t('Edit Profile') : profile.name}
        onClick={isEditable && onEdit ? onEdit : handleSelect}
      >
        {isEditable ? (
          <LuPencil className="size-4" />
        ) : (
          <LuChevronRight className="size-4" />
        )}
      </Button>
    </div>
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
  const t = useTranslations();
  const logout = useAuthLogout();

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

  const deleteOrganizationEnabled = useFeatureFlag('delete_organization');

  return (
    <>
      <div className="flex flex-col gap-3 px-3">
        {userProfiles?.map((profile) => (
          <ProfileMenuRow
            key={profile.id}
            profile={profile}
            description={profile.bio ?? undefined}
            isEditable
            onEdit={() => {
              setIsProfileOpen(true);
              onClose?.();
            }}
            onClose={onClose}
            onProfileSwitch={onProfileSwitch}
          />
        ))}

        {orgProfiles?.length ? <Separator /> : null}

        {orgProfiles?.map((profile) => (
          <ProfileMenuRow
            key={profile.id}
            profile={profile}
            description={t('Organization')}
            onClose={onClose}
            onProfileSwitch={onProfileSwitch}
          />
        ))}
      </div>

      <Separator />

      <div className="flex flex-col gap-1 py-2">
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-1.5 rounded-md px-3 py-2 font-normal text-foreground"
          onClick={() => {
            window.open(
              'https://oneprojectorg.notion.site/Common-Support-Hub-a9ef0b6622538269927c01e51045638b',
              '_blank',
              'noopener,noreferrer',
            );

            onClose?.();
          }}
        >
          <LuCircleHelp className="size-4" /> {t('Feature Requests & Support')}
        </Button>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-1.5 rounded-md px-3 py-2 font-normal text-foreground"
          onClick={() => {
            // Full-page navigation: client-side routing would re-render the
            // authed tree with a dead session before the redirect lands.
            void logout.refetch().finally(() => window.location.assign('/'));
            onClose?.();
          }}
        >
          <LuLogOut className="size-4" /> {t('Log out')}
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col gap-2 px-3">
        <div className="flex flex-col items-start gap-2">
          <PrivacyPolicyModal />
          <ToSModal />
          <CommunityCommitmentsModal />
          {deleteOrganizationEnabled && (
            <button
              type="button"
              className="text-sm font-strong text-foreground hover:underline"
              onClick={() => {
                setIsOrgDeletionOpen(true);
                onClose?.();
              }}
            >
              {t('Delete my account')}
            </button>
          )}
        </div>
        <div className="flex items-center px-3 py-1">
          <p className="text-xs text-muted-foreground">
            <span
              className="cursor-pointer text-primary hover:underline"
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
          </p>
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
        size="lg"
      />
      <div className="absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-muted ring-2 ring-background">
        <LuChevronDown className="size-3 text-foreground" />
      </div>
    </button>
  );

  if (isMobile) {
    return (
      <>
        {avatarButton}
        <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DialogContent
            showCloseButton={false}
            className="top-auto bottom-0 left-0 max-h-[85svh] w-full max-w-none translate-x-0 translate-y-0 rounded-t rounded-b-none border-0 p-0"
          >
            <DialogTitle className="sr-only">{t('Open menu')}</DialogTitle>
            <div className="pb-safe flex w-full flex-col gap-3 py-4 pb-8">
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
          className="flex w-78 flex-col gap-3 p-0 py-4"
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
            <div className="size-10 rounded-full border bg-white shadow" />
          }
        >
          <Suspense
            fallback={
              <Skeleton className="size-10 rounded-full border bg-white shadow" />
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
      <header className="gridCentered hidden h-auto w-full items-center justify-between border-b border-border bg-background px-6 py-2 sm:grid">
        <div className="flex items-center gap-3">
          <SidebarTrigger
            aria-label={t('Open menu')}
            className="size-11 rounded-lg"
          />
          <Link href="/" className="flex gap-1" aria-label={t('Home')}>
            <CommonLogo />
          </Link>
        </div>
        <span className="flex items-center justify-center">
          <ErrorBoundary fallback={<Skeleton className="h-11 w-96" />}>
            <SearchInput />
          </ErrorBoundary>
        </span>
        <div className="flex items-center gap-3">
          <HeaderActions />
        </div>
      </header>

      {/* Mobile */}
      <header className="flex h-auto w-full items-center justify-between border-b border-border bg-background px-4 py-2 sm:hidden">
        {!isMobileSearchExpanded && (
          <div className="flex items-center gap-3">
            <SidebarTrigger
              aria-label={t('Open menu')}
              className="size-8 rounded-lg"
            />
            <Link href="/" className="flex gap-1" aria-label={t('Home')}>
              <CommonLogo />
            </Link>
          </div>
        )}

        <div
          className={`flex ${isMobileSearchExpanded ? 'w-full items-center justify-between' : 'gap-3'}`}
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
                className="ms-3 whitespace-nowrap text-muted-foreground"
              >
                {t('Cancel')}
              </button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setIsMobileSearchExpanded(true)}
                aria-label={t('Search')}
              >
                <LuSearch className="size-4 text-muted-foreground" />
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
