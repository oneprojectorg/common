'use client';

import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import { IconButton } from '@op/ui/IconButton';
import { Menu, MenuItem, MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import React, { useMemo } from 'react';
import { LuEllipsis, LuUsers } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '@/components/RelationshipList';

type Member = {
  id: string;
  authUserId: string;
  name: string | null;
  email: string;
  about: string | null;
  organizationId: string;
  profile: {
    id: string;
    name: string | null;
    slug: string;
    bio: string | null;
    email: string | null;
    type: string;
    avatarImage: {
      id: string;
      name: string | null;
    } | null;
  } | null;
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
};

const MemberMenu = ({
  member,
  organizationId,
  profileId,
}: {
  member: Member;
  organizationId: string;
  profileId: string;
}) => {
  const utils = trpc.useUtils();
  const t = useTranslations();

  // Query for all available roles to find the "Member" role ID
  const { data: roles } = trpc.organization.getRoles.useQuery();

  const updateUser = trpc.organization.updateOrganizationUser.useMutation({
    onSuccess: (_, variables) => {
      // Determine what role was assigned for the success message
      const wasChangingToAdmin = variables.data.roleIds?.some((roleId) =>
        roles?.roles?.find(
          (role: any) =>
            role.id === roleId && role.name.toLowerCase() === 'admin',
        ),
      );

      const message = wasChangingToAdmin
        ? t('User changed to Admin successfully')
        : t('User changed to Member successfully');

      toast.success({ message });
      // Invalidate listUsers query to refresh the UI
      void utils.organization.listUsers.invalidate({ profileId });
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to update user role'),
      });
    },
  });

  const deleteUser = trpc.organization.deleteOrganizationUser.useMutation({
    onSuccess: () => {
      toast.success({
        message: t('User removed from organization successfully'),
      });
      // Invalidate listUsers query to refresh the UI
      void utils.organization.listUsers.invalidate({ profileId });
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to remove user from organization'),
      });
    },
  });

  // Check if user is currently an admin
  const isCurrentlyAdmin = member.roles.some(
    (role) => role.name.toLowerCase() === 'admin',
  );

  const handleRoleToggle = () => {
    if (isCurrentlyAdmin) {
      // Change admin to member
      const memberRole = roles?.roles?.find(
        (role: any) => role.name.toLowerCase() === 'member',
      );

      if (!memberRole) {
        toast.error({ message: t('Member role not found') });
        return;
      }

      updateUser.mutate({
        organizationId,
        organizationUserId: member.id,
        data: {
          roleIds: [memberRole.id], // Set to Member role only
        },
      });
    } else {
      // Change member to admin
      const adminRole = roles?.roles?.find(
        (role: any) => role.name.toLowerCase() === 'admin',
      );

      if (!adminRole) {
        toast.error({ message: t('Admin role not found') });
        return;
      }

      updateUser.mutate({
        organizationId,
        organizationUserId: member.id,
        data: {
          roleIds: [adminRole.id], // Set to Admin role only
        },
      });
    }
  };

  const handleRemoveFromOrganization = () => {
    if (
      confirm(
        t('Are you sure you want to remove this user from the organization?'),
      )
    ) {
      deleteUser.mutate({
        organizationId,
        organizationUserId: member.id,
      });
    }
  };

  return (
    <MenuTrigger>
      <IconButton
        variant="ghost"
        size="small"
        className="aria-expanded:bg-neutral-gray1"
      >
        <LuEllipsis className="size-4" />
      </IconButton>
      <Popover placement="bottom end">
        <Menu className="min-w-48 p-2">
          <MenuItem
            key="toggle-role"
            onAction={handleRoleToggle}
            className="px-3 py-1"
          >
            {isCurrentlyAdmin ? t('Change to Member') : t('Change to Admin')}
          </MenuItem>
          <MenuItem
            key="remove-from-org"
            onAction={handleRemoveFromOrganization}
            className="px-3 py-1 text-functional-red"
          >
            {t('Remove from organization')}
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};

const MembersListContent = ({
  members,
  organizationId,
  profileId,
}: {
  members: Member[];
  organizationId: string;
  profileId: string;
}) => {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
      {members.map((member) => {
        // Use profile data if available, fallback to organization user data
        const profile = member.profile;
        const displayName = profile?.name || member.name || member.email;
        const bio = profile?.bio || member.about;

        // Create a RelationshipListItem-like object for ProfileAvatar
        const profileForAvatar = profile
          ? {
              id: profile.id,
              name: profile.name || displayName,
              slug: profile.slug,
              bio: profile.bio,
              avatarImage: profile.avatarImage,
              type: profile.type,
            }
          : {
              id: member.id,
              name: displayName,
              slug: '', // No slug for non-profile users
              bio: member.about,
              avatarImage: null,
              type: 'individual', // Default type
            };

        return (
          <div
            key={member.id}
            className="relative flex w-full gap-4 rounded border border-neutral-gray1 p-6"
          >
            <div className="absolute right-4 top-4">
              <MemberMenu
                member={member}
                organizationId={organizationId}
                profileId={profileId}
              />
            </div>
            <div className="flex-shrink-0">
              <ProfileAvatar profile={profileForAvatar} className="size-20" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  {/* Show name as link if profile exists, otherwise plain text */}
                  {profile ? (
                    <Link
                      className="truncate font-semibold text-neutral-black"
                      href={
                        profile.type === 'org'
                          ? `/org/${profile.slug}`
                          : `/profile/${profile.slug}`
                      }
                    >
                      {displayName}
                    </Link>
                  ) : (
                    <div className="truncate font-semibold text-neutral-black">
                      {displayName}
                    </div>
                  )}

                  {/* Show role information */}
                  {member.roles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      <TagGroup>
                        {member.roles.map((role) => (
                          <Tag key={role.id} className="text-xs">
                            {role.name}
                          </Tag>
                        ))}
                      </TagGroup>
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-charcoal">
                      {t('Member')}
                    </div>
                  )}

                  {/* Show email if different from display name */}
                  {(member.name || profile?.name) && (
                    <div className="text-sm text-neutral-charcoal">
                      {member.profile?.email || member.email}
                    </div>
                  )}
                </div>

                {/* Show about/bio information if available */}
                {bio && (
                  <div className="line-clamp-3 text-neutral-charcoal">
                    {bio.length > 200 ? `${bio.slice(0, 200)}...` : bio}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const MembersList = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();

  const [members] = trpc.organization.listUsers.useSuspenseQuery({
    profileId,
  });

  // We need to get the organizationId from the profileId
  // This assumes the profileId belongs to an organization
  const organizationId =
    members && members.length > 0 && members[0]
      ? members[0].organizationId
      : '';

  // Group members by roles for filtering
  const rolesSegmented: Array<[string, Array<Member>]> = useMemo(() => {
    if (!members) return [];

    // Get all unique role names
    const allRoleNames = new Set<string>();
    members.forEach((member) => {
      member.roles.forEach((role) => {
        allRoleNames.add(role.name);
      });
    });

    // Create segments for each role
    return Array.from(allRoleNames).map((roleName) => [
      roleName,
      members.filter((member) =>
        member.roles.some((role) => role.name === roleName),
      ),
    ]);
  }, [members]);

  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-neutral-gray1">
          <LuUsers className="h-6 w-6 text-neutral-gray4" />
        </div>
        <div className="mb-2 font-serif text-title-base text-neutral-black">
          {t('No members found')}
        </div>
        <p className="max-w-md text-sm text-neutral-charcoal">
          {t("This organization doesn't have any members yet.")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:px-0">
        <div className="flex items-center justify-between">
          <div className="w-full font-serif text-title-sm sm:text-title-lg">
            {members.length} {pluralize(t('member'), members.length)}
          </div>
          <div className="w-72"></div>
        </div>
      </div>

      <Tabs>
        <TabList className="px-4 sm:px-0" variant="pill">
          <Tab id="all" variant="pill">
            {t('All members')}
          </Tab>
          {rolesSegmented.map(([roleName, roleMembers]) =>
            roleMembers?.length ? (
              <Tab id={roleName} key={roleName} variant="pill">
                {roleName}s
              </Tab>
            ) : null,
          )}
        </TabList>

        <TabPanel id="all" className="px-4 sm:px-0">
          <MembersListContent
            members={members}
            organizationId={organizationId}
            profileId={profileId}
          />
        </TabPanel>

        {rolesSegmented.map(([roleName, roleMembers]) =>
          roleMembers?.length ? (
            <TabPanel id={roleName} key={roleName} className="px-4 sm:px-0">
              <MembersListContent
                members={roleMembers}
                organizationId={organizationId}
                profileId={profileId}
              />
            </TabPanel>
          ) : null,
        )}
      </Tabs>
    </>
  );
};
