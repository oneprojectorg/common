'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getPublicUrl } from '@/utils';
import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType, Profile } from '@op/api/encoders';
import { useAuthLogout, useMediaQuery } from '@op/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
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
    'group/row grid h-auto w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-lg border p-4 text-start outline-none',
    isCurrent ? 'border-accent-foreground bg-accent' : 'border-border',
  );

  const content = (
    <>
      <ProfileItem
        avatar={
          <ProfileAvatar
            name={profile.name}
            imageName={profile.avatarImage?.name}
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

  // On desktop the rows are real menu items (roving keyboard focus); in the
  // mobile sheet base-ui menu items can't mount, so they fall back to buttons.
  const Divider = asMenuItem ? DropdownMenuSeparator : Separator;

  const Section = ({
    className,
    children,
  }: {
    className?: string;
    children: ReactNode;
  }) =>
    asMenuItem ? (
      <DropdownMenuGroup className={className}>{children}</DropdownMenuGroup>
    ) : (
      <div className={className}>{children}</div>
    );

  const ActionRow = ({
    className,
    onClick,
    children,
  }: {
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

  // A menu row that navigates (opens an external link). Uses base-ui
  // Menu.LinkItem on desktop so it's a real `<a>` in the roving focus; a plain
  // anchor in the mobile sheet.
  const LinkRow = ({
    href,
    className,
    onClick,
    children,
  }: {
    href: string;
    className?: string;
    onClick?: () => void;
    children: ReactNode;
  }) => {
    const shared = cn(
      'flex h-auto w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-start no-underline outline-none',
      className,
    );

    if (asMenuItem) {
      return (
        <DropdownMenuLinkItem
          href={href}
          target="_blank"
          rel="noopener,noreferrer"
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
        rel="noopener,noreferrer"
        className={cn(shared, 'hover:bg-muted')}
        onClick={onClick}
      >
        {children}
      </a>
    );
  };

  return (
    <>
      <Section className="flex flex-col gap-3 px-3">
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

        <Divider />
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
      </Section>

      <Divider />

      <Section className="flex flex-col gap-1 py-2">
        <LinkRow
          href="https://oneprojectorg.notion.site/Common-Support-Hub-a9ef0b6622538269927c01e51045638b"
          className="font-normal text-foreground"
          onClick={onClose}
        >
          <LuCircleHelp className="size-4" /> {t('Feature Requests & Support')}
        </LinkRow>
        <ActionRow
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
      </Section>

      <Divider />

      <Section className="flex flex-col gap-2 px-3">
        <ActionRow
          className="justify-start p-1 text-sm font-strong text-primary hover:underline"
          onClick={() => onOpenLegal('privacy')}
        >
          {t('Privacy Policy')}
        </ActionRow>
        <ActionRow
          className="justify-start p-1 text-sm font-strong text-primary hover:underline"
          onClick={() => onOpenLegal('tos')}
        >
          {t('Terms of Service')}
        </ActionRow>
        <ActionRow
          className="justify-start p-1 text-sm font-strong text-primary hover:underline"
          onClick={() => onOpenLegal('community')}
        >
          {t('Community Commitments')}
        </ActionRow>
        {deleteOrganizationEnabled ? (
          <ActionRow
            className="justify-start p-1 text-sm font-strong text-foreground hover:underline"
            onClick={onDeleteAccount}
          >
            {t('Delete my account')}
          </ActionRow>
        ) : null}

        <div className="flex gap-1 px-1 text-xs text-muted-foreground">
          {asMenuItem ? (
            // A real menu link item (base-ui Menu.LinkItem) so it joins the
            // menu's roving focus — a bare link at the bottom made the menu
            // open scrolled down (initial focus jumped to it).
            <DropdownMenuLinkItem
              href="https://github.com/oneprojectorg/common"
              target="_blank"
              rel="noopener,noreferrer"
              className="inline h-auto rounded-none p-0 text-xs hover:underline"
            >
              {t('Ethical Open Source')}
            </DropdownMenuLinkItem>
          ) : (
            <Link
              className="cursor-pointer hover:underline"
              href="https://github.com/oneprojectorg/common"
              target="_blank"
              rel="noopener,noreferrer"
            >
              {t('Ethical Open Source')}
            </Link>
          )}
          <Bullet />
          <span>One Project</span>
          <Bullet />
          <span>{new Date().getFullYear()}</span>
        </div>
      </Section>
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
        className="flex max-h-[85vh] flex-col p-0 sm:max-w-[36rem]"
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
        imageName={user.currentProfile?.avatarImage?.name}
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
          <DialogTrigger className={cn('relative', className)}>
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
        <DropdownMenuTrigger className={cn('relative', className)}>
          {avatarContent}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          sideOffset={6}
          align="end"
          className="flex w-78 flex-col gap-3 p-0 py-4"
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
