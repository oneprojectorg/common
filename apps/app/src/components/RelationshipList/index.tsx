'use client';

import { getPublicUrl } from '@/utils';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { cn, getGradientForString } from '@op/ui/utils';
import Image from 'next/image';
import React from 'react';

import { Link, useTranslations } from '@/lib/i18n';

type RelationshipListItem = {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  avatarImage?: { id: string; name: string | null } | null;
  type: string;
  // For relationships, we might have relationship info
  relationships?: Array<{
    relationshipType: string;
    pending?: boolean | null;
  }>;
};

export const ProfileAvatar = ({
  profile,
  className,
}: {
  profile: RelationshipListItem;
  className?: string;
}) => {
  const avatarUrl = profile.avatarImage?.name
    ? getPublicUrl(profile.avatarImage.name)
    : null;
  const gradientBg = getGradientForString(profile.name || 'Profile');

  return (
    <Link
      href={`/profile/${profile.slug}`}
      className={cn('relative block overflow-hidden rounded-full', className)}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill className="object-cover" />
      ) : (
        <div className={cn('h-full w-full', gradientBg)} />
      )}
    </Link>
  );
};

const RelationshipListContent = ({
  profiles,
  relationshipMap,
  children,
}: {
  profiles: Array<RelationshipListItem>;
  relationshipMap?: Record<string, { label: string }>;
  children?: React.ReactNode;
}) => {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-1 gap-8 pb-6 md:grid-cols-2">
      {children ||
        profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex w-full gap-4 rounded border border-neutral-gray1 p-6"
          >
            <div className="flex-shrink-0">
              <ProfileAvatar profile={profile} className="size-20" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <Link
                    className="truncate font-semibold text-neutral-black"
                    href={
                      profile.type === 'org'
                        ? `/org/${profile.slug}`
                        : `/profile/${profile.slug}`
                    }
                  >
                    {profile.name}
                  </Link>

                  {/* Show relationship types if available */}
                  {profile.relationships && relationshipMap ? (
                    <div className="text-neutral-black">
                      {profile.relationships.map((relationship, i, arr) => (
                        <React.Fragment key={relationship.relationshipType}>
                          {relationshipMap[relationship.relationshipType]
                            ?.label ?? t('Relationship')}
                          {relationship.pending && (
                            <TagGroup className="ml-1 inline-flex">
                              <Tag className="rounded-sm px-1 py-0.5 text-xs">
                                {t('Pending')}
                              </Tag>
                            </TagGroup>
                          )}
                          {i < arr.length - 1 && (
                            <span className="mx-1">•</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    /* Show profile type if no relationships */
                    <div className="text-sm capitalize text-neutral-charcoal">
                      {profile.type === 'org' ? t('Organization') : t('Individual')}
                    </div>
                  )}
                </div>

                {profile.bio && (
                  <div className="line-clamp-3 text-neutral-charcoal">
                    {profile.bio.length > 200
                      ? `${profile.bio.slice(0, 200)}...`
                      : profile.bio}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};

export interface RelationshipListProps {
  profiles: Array<RelationshipListItem>;
  title?: string;
  searchTerm?: string;
  relationshipMap?: Record<string, { label: string }>;
}

export const RelationshipList = ({
  profiles,
  title,
  searchTerm,
  relationshipMap,
}: RelationshipListProps) => {
  const filteredProfiles = React.useMemo(() => {
    if (!searchTerm) return profiles;

    return profiles.filter((profile) => {
      const nameMatch = profile.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const bioMatch = profile.bio
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const relationshipMatch = profile.relationships?.some((rel) =>
        relationshipMap?.[rel.relationshipType]?.label
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      );

      return nameMatch || bioMatch || relationshipMatch;
    });
  }, [profiles, searchTerm, relationshipMap]);

  return (
    <>
      {title && (
        <div className="flex flex-col gap-4 px-0">
          <div className="flex items-center justify-between">
            <div className="w-full font-serif text-title-sm sm:text-title-lg">
              {title}
            </div>
          </div>
        </div>
      )}
      <div className="px-0">
        <RelationshipListContent
          profiles={filteredProfiles}
          relationshipMap={relationshipMap}
        />
      </div>
    </>
  );
};

export type { RelationshipListItem };
