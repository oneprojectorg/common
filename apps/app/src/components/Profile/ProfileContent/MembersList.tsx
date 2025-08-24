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

import { Link } from '@/lib/i18n';

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

const MemberMenu = ({ member }: { member: Member }) => {
  const handleChangeToMember = () => {
    // TODO: Implement API call to change user role to member
    console.log('Changing member to member:', member.id);
    toast.success({ message: 'Changed to member successfully' });
  };

  const handleRemoveFromOrganization = () => {
    // TODO: Implement API call to remove user from organization
    console.log('Removing member from organization:', member.id);
    toast.success({ message: 'Removed from organization successfully' });
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
            key="change-to-member"
            onAction={handleChangeToMember}
            className="px-3 py-1"
          >
            Change to Member
          </MenuItem>
          <MenuItem
            key="remove-from-org"
            onAction={handleRemoveFromOrganization}
            className="px-3 py-1 text-functional-red"
          >
            Remove from organization
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};

const MembersListContent = ({ members }: { members: Member[] }) => {
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
              <MemberMenu member={member} />
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
                    <div className="text-sm text-neutral-charcoal">Member</div>
                  )}

                  {/* Show email if different from display name */}
                  {(member.name || profile?.name) && (
                    <div className="text-sm text-neutral-charcoal">
                      {member.email}
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
  const [members] = trpc.organization.listUsers.useSuspenseQuery({
    profileId,
  });

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
          No members found
        </div>
        <p className="max-w-md text-sm text-neutral-charcoal">
          This organization doesn't have any members yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:px-0">
        <div className="flex items-center justify-between">
          <div className="w-full font-serif text-title-sm sm:text-title-lg">
            {members.length} {pluralize('member', members.length)}
          </div>
          <div className="w-72"></div>
        </div>
      </div>

      <Tabs>
        <TabList className="px-4 sm:px-0" variant="pill">
          <Tab id="all" variant="pill">
            All members
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
          <MembersListContent members={members} />
        </TabPanel>

        {rolesSegmented.map(([roleName, roleMembers]) =>
          roleMembers?.length ? (
            <TabPanel id={roleName} key={roleName} className="px-4 sm:px-0">
              <MembersListContent members={roleMembers} />
            </TabPanel>
          ) : null,
        )}
      </Tabs>
    </>
  );
};
