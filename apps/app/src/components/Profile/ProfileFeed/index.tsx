import { Header3 } from '@/components/Header';
import { getPublicUrl } from '@/utils';
import Image from 'next/image';

import { trpc } from '@op/trpc/client';

import type { Organization } from '@op/trpc/encoders';
import { ReactNode } from 'react';
import { cn } from '@op/ui/utils';
import { TextArea } from '@op/ui/Field';
import { Button } from '@op/ui/Button';

// TODO: generated this quick with AI. refactor it!
const formatRelativeTime = (timestamp: Date | string | number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  let diff = Math.floor((now.getTime() - date.getTime()) / 1000); // difference in seconds

  // Future dates handling
  if (diff < 0) {
    return 'in the future';
  }

  // For very recent times
  if (diff < 5) {
    return 'just now';
  }

  const intervals = [
    { unit: 'year', seconds: 31557600 },
    { unit: 'month', seconds: 2629800 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    if (diff >= interval.seconds) {
      const count = Math.floor(diff / interval.seconds);
      return count + ' ' + interval.unit + (count !== 1 ? 's' : '');
    }
  }

  return 'just now';
};

const FeedItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return <div className={cn('flex gap-4', className)}>{children}</div>;
};

const FeedContent = ({ children }: { children: ReactNode }) => {
  return <div className="leading-6">{children}</div>;
};

const FeedHeader = ({ children }: { children: ReactNode }) => {
  return <span className="flex items-baseline gap-2">{children}</span>;
};

const FeedAvatar = ({ children }: { children: ReactNode }) => {
  return <div className="relative w-16">{children}</div>;
};

const FeedMain = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-16 w-full flex-col items-start justify-start gap-3">
      {children}
    </div>
  );
};

export const ProfileFeed = ({ profile }: { profile: Organization }) => {
  const [posts] = trpc.organization.listPosts.useSuspenseQuery({
    slug: profile.slug,
  });

  const profileImageUrl = getPublicUrl(profile.avatarImage?.name);

  return (
    <div className="flex flex-col gap-8">
      <FeedItem className="border-b pb-8">
        <FeedAvatar>
          {profileImageUrl ? (
            <Image
              src={profileImageUrl}
              alt=""
              fill
              className="!size-16 max-h-16 max-w-16"
            />
          ) : (
            <div className="size-16 rounded-full border bg-white shadow" />
          )}
        </FeedAvatar>
        <FeedMain>
          <div className="flex w-full gap-4">
            <TextArea
              className="h-full w-full"
              placeholder={`Post an update from ${profile.name}`}
            />
            <Button color="secondary">Post</Button>
          </div>
        </FeedMain>
      </FeedItem>
      {posts.length > 0 ? (
        posts.map(({ content, createdAt }, i) => (
          <FeedItem key={i}>
            <FeedAvatar>
              {profileImageUrl ? (
                <Image
                  src={profileImageUrl}
                  alt=""
                  fill
                  className="!size-16 max-h-16 max-w-16"
                />
              ) : (
                <div className="size-16 rounded-full border bg-white shadow" />
              )}
            </FeedAvatar>
            <FeedMain>
              <FeedHeader>
                <Header3 className="font-medium leading-5">
                  {profile.name}
                </Header3>
                {createdAt ? (
                  <span className="text-xs text-darkGray">
                    {formatRelativeTime(createdAt)}
                  </span>
                ) : null}
              </FeedHeader>
              <FeedContent>{content}</FeedContent>
            </FeedMain>
          </FeedItem>
        ))
      ) : (
        <>Nothing to see</>
      )}
    </div>
  );
};
