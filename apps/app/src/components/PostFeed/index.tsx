import { getPublicUrl } from '@/utils';
import { detectLinks } from '@/utils/linkDetection';
import type { PostToOrganization } from '@op/api/encoders';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { Header3 } from '@op/ui/Header';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { ReactNode } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';

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
  return (
    <div
      className={cn('w-full leading-6', className)}
      style={{ overflowWrap: 'anywhere' }}
    >
      {children}
    </div>
  );
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
  ...props
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'flex min-h-16 w-full flex-col items-start justify-start gap-2',
        className,
      )}
      {...props}
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
        posts.map(({ organization, post }, i) => {
          const { urls } = detectLinks(post?.content);

          return (
            <FeedItem key={i}>
              <OrganizationAvatar
                organization={organization}
                className="!size-8 max-h-8 max-w-8 rounded-full"
              />
              <FeedMain>
                <FeedHeader>
                  <Header3 className="font-medium leading-5">
                    <Link href={`/org/${organization?.slug}`}>
                      {organization?.name}
                    </Link>
                  </Header3>
                  {post?.createdAt ? (
                    <span className="text-xs text-darkGray">
                      {formatRelativeTime(post?.createdAt)}
                    </span>
                  ) : null}
                </FeedHeader>
                <FeedContent>
                  {post?.content}
                  {post.attachments
                    ? post.attachments.map(({ fileName, storageObject }) => {
                        const { mimetype } = storageObject.metadata;

                        return (
                          <MediaDisplay
                            key={storageObject.id}
                            title={fileName}
                            mimeType={mimetype}
                          >
                            <div className="relative flex aspect-video w-full items-center justify-center rounded bg-orangePurple text-white">
                              {mimetype.startsWith('image/') ? (
                                <Image
                                  src={getPublicUrl(storageObject.name) ?? ''}
                                  alt={fileName}
                                  fill={true}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <div className="font-serif text-title-md">
                                  {fileName}
                                </div>
                              )}
                            </div>
                          </MediaDisplay>
                        );
                      })
                    : null}
                  {urls.length > 0 && (
                    <div>
                      {urls.map((url) => (
                        <LinkPreview key={url} url={url} />
                      ))}
                    </div>
                  )}
                </FeedContent>
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

export const PostFeedSkeleton = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex flex-col gap-8 pb-8', className)}>
      <FeedItem>
        <AvatarSkeleton className="!size-8 max-h-8 max-w-8 rounded-full" />
        <FeedMain>
          <FeedHeader>
            <Header3 className="font-medium leading-5">
              <Skeleton />
            </Header3>
            <Skeleton />
          </FeedHeader>
          <FeedContent>
            <SkeletonLine lines={3} />
          </FeedContent>
        </FeedMain>
      </FeedItem>
    </div>
  );
};
