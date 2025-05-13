import { getPublicUrl } from '@/utils';
import type { PostToOrganization } from '@op/api/encoders';
import { Header3 } from '@op/ui/Header';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { ReactNode } from 'react';
import { LuLeaf } from 'react-icons/lu';

// import { useTranslations } from '@/lib/i18n';

// TODO: generated this quick with AI. refactor it!
const formatRelativeTime = (timestamp: Date | string | number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // difference in seconds

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

      return `${count} ${interval.unit}${count !== 1 ? 's' : ''}`;
    }
  }

  return 'just now';
};

export const FeedItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return <div className={cn('flex gap-4', className)}>{children}</div>;
};

export const FeedContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return <div className={cn('leading-6', className)}>{children}</div>;
};

const FeedHeader = ({ children }: { children: ReactNode }) => {
  return <span className="flex items-baseline gap-2">{children}</span>;
};

export const FeedAvatar = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="shadown relative w-8 min-w-8 overflow-hidden">
      {children}
    </div>
  );
};

export const FeedMain = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'flex min-h-16 w-full flex-col items-start justify-start gap-2',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const PostFeed = ({
  posts,
  className,
}: {
  posts: Array<PostToOrganization>;
  className?: string;
}) => {
  // const t = useTranslations();

  return (
    <div className={cn('flex flex-col gap-8 pb-8', className)}>
      {posts.length > 0 ? (
        posts.map(({ organization, post: { content, createdAt } }, i) => {
          const profileImageUrl = getPublicUrl(organization?.avatarImage?.name);

          return (
            <FeedItem key={i}>
              <FeedAvatar>
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt=""
                    fill
                    className="!size-8 max-h-8 max-w-8 rounded-full"
                  />
                ) : (
                  <div className="size-8 rounded-full border bg-white" />
                )}
              </FeedAvatar>
              <FeedMain>
                <FeedHeader>
                  <Header3 className="font-medium leading-5">
                    {organization?.name}
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
          );
        })
      ) : (
        <FeedItem>
          <FeedMain className="flex w-full flex-col items-center justify-center py-6">
            <FeedContent className="flex flex-col items-center justify-center text-neutral-gray4">
              <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
                <LuLeaf />
              </div>
              <span>{'No posts yet.'}</span>
            </FeedContent>
          </FeedMain>
        </FeedItem>
      )}
    </div>
  );
};
