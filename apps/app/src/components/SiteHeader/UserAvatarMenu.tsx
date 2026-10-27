'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getPublicUrl } from '@/utils';
import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { useAuthLogout, useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Separator } from '@op/sense/Separator';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import dynamic from 'next/dynamic';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  LuArrowLeftToLine,
  LuChevronDown,
  LuCircleHelp,
  LuPencil,
  LuSettings,
} from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { UpdateProfileModal } from '../Profile/ProfileDetails/UpdateProfile/UpdateProfileModal';
import { ProfileSwitchingModal } from '../ProfileSwitchingModal';

// behind a flag and rarely opened, so it stays out of every page's header chunk
const SettingsModal = dynamic(
  () => import('../SettingsModal').then((module) => module.SettingsModal),
  { ssr: false },
);

/**
 * A compact profile/org switcher row. Renders as a base-ui `DropdownMenuItem` in the
 * desktop dropdown (`asMenuItem`) and as a plain button in the mobile bottom
 * sheet — base-ui `Menu.Item` needs a `Menu.Root` context and cannot render
 * inside the sheet's `Dialog`.
 */
const ProfileMenuRow = ({
  profile,
  asMenuItem = false,
  onClose,
  onProfileSwitch,
}: {
  profile: Profile;
  asMenuItem?: boolean;
  onClose?: () => void;
  onProfileSwitch?: (profile: {
    name: string;
    avatarImage?: { name: string } | null;
  }) => void;
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

  const t = useTranslations();
  const className = MENU_ROW_CLASS;

  const content = (
    <>
      <ProfileAvatar
        name={profile.name}
        src={
          profile.avatarImage?.name
            ? (getPublicUrl(profile.avatarImage.name) ?? undefined)
            : undefined
        }
        alt=""
        size="sm"
      />
      <span
        dir="auto"
        className="min-w-0 flex-1 truncate ltr:text-left rtl:text-right"
      >
        {profile.name}
      </span>
      {isCurrent ? (
        <span className="shrink-0 text-sm text-primary">
          {t('shell.activeProfileLabel')}
        </span>
      ) : null}
    </>
  );

  if (asMenuItem) {
    return (
      <DropdownMenuItem className={className} onClick={handleSelect}>
        {content}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(className, 'hover:bg-muted')}
      onClick={handleSelect}
    >
      {content}
    </Button>
  );
};

// `font-normal` undoes Button's `font-strong` in the mobile sheet.
const MENU_ROW_CLASS =
  'flex h-10 w-full cursor-pointer items-center justify-start gap-2 rounded-xs px-2 py-0 text-start text-sm font-normal text-foreground outline-none';

// On desktop the rows are real menu items (roving keyboard focus); in the
// mobile sheet base-ui menu items can't mount, so they fall back to buttons /
// plain elements. These live at module scope (not inside AvatarMenuContent) so
// a re-render doesn't remount the whole menu and drop keyboard focus.
const MenuDivider = ({ asMenuItem }: { asMenuItem?: boolean }) =>
  asMenuItem ? <DropdownMenuSeparator /> : <Separator />;

const MenuSection = ({
  asMenuItem,
  className,
  children,
}: {
  asMenuItem?: boolean;
  className?: string;
  children: ReactNode;
}) =>
  asMenuItem ? (
    <DropdownMenuGroup className={className}>{children}</DropdownMenuGroup>
  ) : (
    <div className={className}>{children}</div>
  );

const MenuLabel = ({
  asMenuItem,
  children,
}: {
  asMenuItem?: boolean;
  children: ReactNode;
}) => {
  const className = 'px-2 py-1.5 text-sm font-strong text-muted-foreground';
  return asMenuItem ? (
    <DropdownMenuLabel className={className}>{children}</DropdownMenuLabel>
  ) : (
    <div className={className}>{children}</div>
  );
};

const ActionRow = ({
  asMenuItem,
  className,
  onClick,
  children,
}: {
  asMenuItem?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) => {
  const shared = cn(MENU_ROW_CLASS, className);

  if (asMenuItem) {
    return (
      <DropdownMenuItem className={shared} onClick={onClick}>
        {children}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(shared, 'hover:bg-muted')}
      onClick={onClick}
    >
      {children}
    </Button>
  );
};

// A menu row that navigates (opens an external link). Uses base-ui
// Menu.LinkItem on desktop so it's a real `<a>` in the roving focus; a plain
// anchor in the mobile sheet.
const LinkRow = ({
  asMenuItem,
  href,
  className,
  onClick,
  children,
}: {
  asMenuItem?: boolean;
  href: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) => {
  const shared = cn(
    MENU_ROW_CLASS,
    'no-underline hover:no-underline',
    className,
  );

  if (asMenuItem) {
    return (
      <DropdownMenuLinkItem
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={shared}
        onClick={onClick}
      >
        {children}
      </DropdownMenuLinkItem>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={shared}
      onClick={onClick}
    >
      {children}
    </a>
  );
};

const AvatarMenuContent = ({
  asMenuItem = false,
  onClose,
  onProfileSwitch,
  onEditProfile,
  onOpenSettings,
}: {
  asMenuItem?: boolean;
  onClose?: () => void;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  onProfileSwitch?: (profile: {
    name: string;
    avatarImage?: { name: string } | null;
  }) => void;
}) => {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const logout = useAuthLogout();
  const isSettingsEnabled = useFeatureFlag('settings_modal');

  const { data: profilesData } = trpc.account.getUserProfiles.useQuery();
  const profiles = profilesData?.items;

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

  return (
    <>
      {user.profile ? (
        <div className="flex items-center gap-2 p-2">
          <ProfileAvatar
            name={user.profile.name}
            src={
              user.profile.avatarImage?.name
                ? (getPublicUrl(user.profile.avatarImage.name) ?? undefined)
                : undefined
            }
            alt=""
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span
              dir="auto"
              className="truncate font-strong ltr:text-left rtl:text-right"
            >
              {user.profile.name}
            </span>
            {user.profile.bio ? (
              <span
                dir="auto"
                className="truncate text-sm text-muted-foreground ltr:text-left rtl:text-right"
              >
                {user.profile.bio}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <MenuDivider asMenuItem={asMenuItem} />

      <MenuSection asMenuItem={asMenuItem} className="flex flex-col">
        <ActionRow asMenuItem={asMenuItem} onClick={onEditProfile}>
          <LuPencil className="size-4" /> {t('shell.editProfileAction')}
        </ActionRow>
        {isSettingsEnabled && (
          <ActionRow asMenuItem={asMenuItem} onClick={onOpenSettings}>
            <LuSettings className="size-4" /> {t('shell.settingsAction')}
          </ActionRow>
        )}
      </MenuSection>

      {profiles?.length ? (
        <>
          <MenuDivider asMenuItem={asMenuItem} />
          <MenuSection asMenuItem={asMenuItem} className="flex flex-col">
            <MenuLabel asMenuItem={asMenuItem}>
              {t('shell.profilesMenuHeading')}
            </MenuLabel>
            {[...(orgProfiles ?? []), ...(userProfiles ?? [])].map(
              (profile) => (
                <ProfileMenuRow
                  key={profile.id}
                  profile={profile}
                  asMenuItem={asMenuItem}
                  onClose={onClose}
                  onProfileSwitch={onProfileSwitch}
                />
              ),
            )}
          </MenuSection>
        </>
      ) : null}

      <MenuDivider asMenuItem={asMenuItem} />

      <MenuSection asMenuItem={asMenuItem} className="flex flex-col">
        <LinkRow
          asMenuItem={asMenuItem}
          href="https://oneprojectorg.notion.site/Common-Support-Hub-a9ef0b6622538269927c01e51045638b"
          onClick={onClose}
        >
          <LuCircleHelp className="size-4" /> {t('shell.supportLinkLabel')}
        </LinkRow>
      </MenuSection>

      <MenuDivider asMenuItem={asMenuItem} />

      <MenuSection asMenuItem={asMenuItem} className="flex flex-col">
        <ActionRow
          asMenuItem={asMenuItem}
          onClick={() => {
            // Full-page navigation: client-side routing would re-render the
            // authed tree with a dead session before the redirect lands.
            const goHome = () => window.location.assign('/');
            void logout.mutateAsync().then(goHome, goHome);
            onClose?.();
          }}
        >
          <LuArrowLeftToLine className="size-4 rtl:-scale-x-100" />{' '}
          {t('shell.logOutAction')}
        </ActionRow>
      </MenuSection>
    </>
  );
};

export const UserAvatarMenu = ({ className }: { className?: string }) => {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsDrawerOpen(false);
  };

  const openSettings = () => {
    closeMenus();
    setIsSettingsOpen(true);
  };

  const settingsModalEnabled = useFeatureFlag('settings_modal');

  const openEditProfile = () => {
    closeMenus();
    setIsEditingProfile(true);
  };

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

  const avatarContent = (
    <>
      <ProfileAvatar
        name={user.currentProfile?.name}
        src={
          user.currentProfile?.avatarImage?.name
            ? (getPublicUrl(user.currentProfile.avatarImage.name) ?? undefined)
            : undefined
        }
        alt="User avatar"
        size="lg"
      />
      <div className="absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-muted ring-2 ring-background">
        <LuChevronDown className="size-3 text-foreground" />
      </div>
    </>
  );

  // Dialogs live outside the menu/sheet so they survive it closing (the
  // shadcn "menu item opens a dialog" pattern).
  const overlays = (
    <>
      <UpdateProfileModal
        isOpen={isEditingProfile}
        setIsOpen={setIsEditingProfile}
      />
      <ProfileSwitchingModal
        isOpen={isSwitchingProfile}
        avatarImage={switchingToProfile?.avatarImage}
        profileName={switchingToProfile?.name}
        onOpenChange={setIsSwitchingProfile}
      />
      {settingsModalEnabled ? (
        <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <>
        <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={cn('relative size-10 rounded-full p-0', className)}
              />
            }
          >
            {avatarContent}
          </DialogTrigger>
          {/* A bottom sheet, deliberately opting out of the full-screen default. */}
          <DialogContent
            showCloseButton={false}
            className="top-auto bottom-0 max-h-[85svh] rounded-t p-0"
          >
            <DialogTitle className="sr-only">
              {t('shell.openMenuLabel')}
            </DialogTitle>
            <div className="pb-safe flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto p-2 pb-8">
              <AvatarMenuContent
                onClose={() => setIsDrawerOpen(false)}
                onEditProfile={openEditProfile}
                onOpenSettings={openSettings}
                onProfileSwitch={handleProfileSwitch}
              />
            </div>
          </DialogContent>
        </Dialog>
        {overlays}
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger
          data-testid="user-menu-trigger"
          render={
            <Button
              variant="ghost"
              size="icon"
              className={cn('relative size-10 rounded-full p-0', className)}
            />
          }
        >
          {avatarContent}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          sideOffset={6}
          align="end"
          className="flex w-66 flex-col gap-0.5 rounded-md p-1"
        >
          <AvatarMenuContent
            asMenuItem
            onClose={() => setIsMenuOpen(false)}
            onEditProfile={openEditProfile}
            onOpenSettings={openSettings}
            onProfileSwitch={handleProfileSwitch}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {overlays}
    </>
  );
};
