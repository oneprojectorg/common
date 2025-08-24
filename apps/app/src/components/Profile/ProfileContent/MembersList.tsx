'use client';

import { trpc } from '@op/api/client';
import { Skeleton } from '@op/ui/Skeleton';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import React from 'react';
import { LuUsers } from 'react-icons/lu';
import { ProfileAvatar } from '@/components/RelationshipList';
import { Link } from '@/lib/i18n';

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

const MembersListContent = ({ members }: { members: Member[] }) => {
  return (
    <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
      {members.map((member) => {
        // Use profile data if available, fallback to organization user data
        const profile = member.profile;
        const displayName = profile?.name || member.name || member.email;
        const bio = profile?.bio || member.about;
        
        // Create a RelationshipListItem-like object for ProfileAvatar
        const profileForAvatar = profile ? {
          id: profile.id,
          name: profile.name || displayName,
          slug: profile.slug,
          bio: profile.bio,
          avatarImage: profile.avatarImage,
          type: profile.type,
        } : {
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
            className="flex w-full gap-4 rounded border border-neutral-gray1 p-6"
          >
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
                    {bio.length > 200
                      ? `${bio.slice(0, 200)}...`
                      : bio}
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

const MembersListSkeleton = () => (
  <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className="flex w-full gap-4 rounded border border-neutral-gray1 p-6"
      >
        <Skeleton className="size-20 flex-shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    ))}
  </div>
);

export const MembersList = ({ profileId }: { profileId: string }) => {
  const [members] = trpc.organization.listUsers.useSuspenseQuery({
    profileId,
  });

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
      <div className="flex flex-col gap-4 px-0">
        <div className="flex items-center justify-between">
          <div className="w-full font-serif text-title-sm sm:text-title-lg">
            Members ({members.length})
          </div>
        </div>
      </div>
      <div className="px-0">
        <MembersListContent members={members} />
      </div>
    </>
  );
};

export const MembersListWithSkeleton = () => (
  <div className="p-4">
    <MembersListSkeleton />
  </div>
);

MembersList.Skeleton = MembersListWithSkeleton;
