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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Separator } from '@op/sense/Separator';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  LuChevronDown,
  LuChevronRight,
  LuCircleHelp,
  LuLogOut,
} from 'react-icons/lu';

import { Link, useRouter, useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { CommunityCommitmentsContent } from '../CommunityCommitmentsContent';
import { DeleteOrganizationModal } from '../DeleteOrganizationModal';
import { PrivacyPolicyContent } from '../PrivacyPolicyContent';
import { ProfileSwitchingModal } from '../ProfileSwitchingModal';
import { ToSContent } from '../ToSContent';

type LegalDialog = 'privacy' | 'tos' | 'community';

/**
 * A profile/org switcher row. Renders as a base-ui `DropdownMenuItem` in the
 * desktop dropdown (`asMenuItem`) and as a plain button in the mobile bottom
 * sheet — base-ui `Menu.Item` needs a `Menu.Root` context and cannot render
 * inside the sheet's `Dialog`.
 */
const ProfileMenuRow = ({
  profile,
  description,
  asMenuItem = false,
  onClose,
  onProfileSwitch,
}: {
  profile: Profile;
  description?: string;
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

  const className = cn(
    'group/row grid h-auto w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-lg border p-4 text-start outline-none hover:border-input hover:bg-muted',
    isCurrent ? 'border-accent-foreground bg-accent' : 'border-border',
  );

  const content = (
    <>
      <ProfileItem
        avatar={
          <ProfileAvatar
            name={profile.name}
            src={
              profile.avatarImage?.name
                ? (getPublicUrl(profile.avatarImage.name) ?? undefined)
                : undefined
            }
            alt={profile.name}
            size="lg"
          />
        }
        title={profile.name}
        titleClassName="font-normal"
        description={description}
      />
      <LuChevronRight className="size-4" />
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
    <Button variant="ghost" className={className} onClick={handleSelect}>
      {content}
    </Button>
  );
};

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
  const shared = cn(
    'flex h-auto w-full cursor-pointer items-center justify-start gap-1.5 rounded-md px-3 py-2 text-start outline-none',
    className,
  );

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

// The legal links are `link`-variant Buttons (teal, underline on hover). On
// desktop the Button is composed onto a DropdownMenuItem (base-ui `render`) so
// it stays in the menu's roving keyboard focus.
const LegalTrigger = ({
  asMenuItem,
  onClick,
  children,
}: {
  asMenuItem?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => {
  const className =
    'h-auto w-full justify-start py-1 px-2 text-sm font-strong text-primary';

  if (asMenuItem) {
    return (
      <DropdownMenuItem className={className} onClick={onClick}>
        {children}
      </DropdownMenuItem>
    );
  }

  return (
    <Button variant="link" className={className} onClick={onClick}>
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
    'flex h-auto w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-start no-underline outline-none hover:no-underline',
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
  onOpenLegal,
  onDeleteAccount,
}: {
  asMenuItem?: boolean;
  onClose?: () => void;
  onOpenLegal: (dialog: LegalDialog) => void;
  onDeleteAccount: () => void;
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
      <MenuSection asMenuItem={asMenuItem} className="flex flex-col gap-3 px-3">
        {userProfiles?.map((profile) => (
          <ProfileMenuRow
            key={profile.id}
            profile={profile}
            description={profile.bio ?? undefined}
            asMenuItem={asMenuItem}
            onClose={onClose}
            onProfileSwitch={onProfileSwitch}
          />
        ))}

        {orgProfiles?.length ? <MenuDivider asMenuItem={asMenuItem} /> : null}
        {orgProfiles?.map((profile) => (
          <ProfileMenuRow
            key={profile.id}
            profile={profile}
            description={t('Organization')}
            asMenuItem={asMenuItem}
            onClose={onClose}
            onProfileSwitch={onProfileSwitch}
          />
        ))}
      </MenuSection>

      <MenuDivider asMenuItem={asMenuItem} />

      <MenuSection asMenuItem={asMenuItem} className="flex flex-col gap-1 p-2">
        <LinkRow
          asMenuItem={asMenuItem}
          href="https://oneprojectorg.notion.site/Common-Support-Hub-a9ef0b6622538269927c01e51045638b"
          className="font-normal text-foreground"
          onClick={onClose}
        >
          <LuCircleHelp className="size-4" /> {t('Feature Requests & Support')}
        </LinkRow>
        <ActionRow
          asMenuItem={asMenuItem}
          className="font-normal text-foreground"
          onClick={() => {
            // Full-page navigation: client-side routing would re-render the
            // authed tree with a dead session before the redirect lands.
            void logout.refetch().finally(() => window.location.assign('/'));
            onClose?.();
          }}
        >
          <LuLogOut className="size-4" /> {t('Log out')}
        </ActionRow>
      </MenuSection>

      <MenuDivider asMenuItem={asMenuItem} />

      <MenuSection asMenuItem={asMenuItem} className="flex flex-col gap-2 px-3">
        <LegalTrigger
          asMenuItem={asMenuItem}
          onClick={() => onOpenLegal('privacy')}
        >
          {t('Privacy Policy')}
        </LegalTrigger>
        <LegalTrigger
          asMenuItem={asMenuItem}
          onClick={() => onOpenLegal('tos')}
        >
          {t('Terms of Service')}
        </LegalTrigger>
        <LegalTrigger
          asMenuItem={asMenuItem}
          onClick={() => onOpenLegal('community')}
        >
          {t('Community Commitments')}
        </LegalTrigger>
        {deleteOrganizationEnabled ? (
          <ActionRow
            asMenuItem={asMenuItem}
            className="justify-start px-2 py-1 text-sm font-strong text-foreground hover:bg-muted hover:underline"
            onClick={onDeleteAccount}
          >
            {t('Delete my account')}
          </ActionRow>
        ) : null}

        <div className="flex gap-1 px-2 text-xs text-muted-foreground">
          {asMenuItem ? (
            // A real menu link item (base-ui Menu.LinkItem) so it joins the
            // menu's roving focus — a bare link at the bottom made the menu
            // open scrolled down (initial focus jumped to it).
            <DropdownMenuLinkItem
              href="https://github.com/oneprojectorg/common"
              target="_blank"
              rel="noopener noreferrer"
              className="inline h-auto rounded-none p-0 text-xs hover:bg-transparent hover:underline"
            >
              {t('Ethical Open Source')}
            </DropdownMenuLinkItem>
          ) : (
            <Link
              className="cursor-pointer hover:underline"
              href="https://github.com/oneprojectorg/common"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('Ethical Open Source')}
            </Link>
          )}
          <Bullet />
          <span>One Project</span>
          <Bullet />
          <span>{new Date().getFullYear()}</span>
        </div>
      </MenuSection>
    </>
  );
};

const legalTitles = {
  privacy: 'Privacy Policy',
  tos: 'Terms of Service',
  community: 'Community Commitments',
} as const;

const LegalDialogs = ({
  open,
  onOpenChange,
}: {
  open: LegalDialog | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useTranslations();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open !== null} onOpenChange={onOpenChange}>
      {/* shadcn scrollable-dialog pattern: fixed header, scrollable body. The
          default DialogContent is a grid with no scroll, so we make it a flex
          column, cap its height, and scroll only the body. `initialFocus` lands
          on the scroll container (top) instead of the first link deep in the
          legal text, which otherwise opens the dialog scrolled partway down. */}
      <DialogContent
        className="flex max-h-[85vh] flex-col p-0 sm:max-w-xl"
        initialFocus={scrollRef}
      >
        <DialogHeader>
          <DialogTitle>{open ? t(legalTitles[open]) : ''}</DialogTitle>
        </DialogHeader>
        <div
          ref={scrollRef}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-4 outline-none"
        >
          {open === 'privacy' ? <PrivacyPolicyContent /> : null}
          {open === 'tos' ? <ToSContent /> : null}
          {open === 'community' ? <CommunityCommitmentsContent /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const UserAvatarMenu = ({ className }: { className?: string }) => {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOrgDeletionOpen, setIsOrgDeletionOpen] = useState(false);
  const [legalDialog, setLegalDialog] = useState<LegalDialog | null>(null);
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

  const openLegal = (dialog: LegalDialog) => {
    closeMenus();
    setLegalDialog(dialog);
  };

  const openDeleteAccount = () => {
    closeMenus();
    setIsOrgDeletionOpen(true);
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
      <LegalDialogs
        open={legalDialog}
        onOpenChange={(next) => {
          if (!next) {
            setLegalDialog(null);
          }
        }}
      />
      <ProfileSwitchingModal
        isOpen={isSwitchingProfile}
        avatarImage={switchingToProfile?.avatarImage}
        profileName={switchingToProfile?.name}
        onOpenChange={setIsSwitchingProfile}
      />
      {deleteOrganizationEnabled ? (
        <DeleteOrganizationModal
          isOpen={isOrgDeletionOpen}
          onOpenChange={setIsOrgDeletionOpen}
        />
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
          <DialogContent
            showCloseButton={false}
            className="top-auto bottom-0 left-0 flex max-h-[85svh] w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-t rounded-b-none border-0 p-0"
          >
            <DialogTitle className="sr-only">{t('Open menu')}</DialogTitle>
            <div className="pb-safe flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto py-4 pb-8">
              <AvatarMenuContent
                onClose={() => setIsDrawerOpen(false)}
                onOpenLegal={openLegal}
                onDeleteAccount={openDeleteAccount}
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
          className="flex w-86 flex-col gap-3 p-0 py-4"
        >
          <AvatarMenuContent
            asMenuItem
            onClose={() => setIsMenuOpen(false)}
            onOpenLegal={openLegal}
            onDeleteAccount={openDeleteAccount}
            onProfileSwitch={handleProfileSwitch}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {overlays}
    </>
  );
};
