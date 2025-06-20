import { getPublicUrl } from '@/utils';
import { OrganizationUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import type { PostToOrganization } from '@op/api/encoders';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { Header3 } from '@op/ui/Header';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { Fragment, ReactNode } from 'react';
import { LuEllipsis, LuLeaf } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';

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
      className={cn('flex w-full flex-col gap-2 leading-6', className)}
      style={{ overflowWrap: 'anywhere' }}
    >
      {children}
    </div>
  );
};

const FeedHeader = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <span className={cn('flex items-baseline gap-2', className)}>
      {children}
    </span>
  );
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
  user,
  className,
  withLinks = true,
}: {
  posts: Array<PostToOrganization>;
  user: OrganizationUser;
  className?: string;
  withLinks?: boolean;
}) => {
  return (
    <div className={cn('flex flex-col gap-4 pb-8', className)}>
      {posts.length > 0 ? (
        posts.map(({ organization, post }, i) => {
          const { urls } = detectLinks(post?.content);

          return (
            <Fragment key={i}>
              <FeedItem>
                <OrganizationAvatar
                  organization={organization}
                  withLink={withLinks}
                  className="!size-8 max-h-8 max-w-8"
                />
                <FeedMain>
                  <FeedHeader>
                    <Header3 className="pt-2 font-medium leading-3">
                      {withLinks ? (
                        <Link href={`/org/${organization?.profile.slug}`}>
                          {organization?.profile.name}
                        </Link>
                      ) : (
                        organization?.profile.name
                      )}
                    </Header3>
                    {post?.createdAt ? (
                      <span className="text-xs text-neutral-gray4">
                        {formatRelativeTime(post?.createdAt)}
                      </span>
                    ) : null}
                    {organization?.id === user?.currentOrganization?.id && (
                      <LuEllipsis className="size-4" />
                    )}
                  </FeedHeader>
                  <FeedContent>
                    {post?.content ? linkifyText(post.content) : null}
                    {post.attachments
                      ? post.attachments.map(({ fileName, storageObject }) => {
                          const { mimetype } = storageObject.metadata;

                          return (
                            <MediaDisplay
                              key={storageObject.id}
                              title={fileName}
                              mimeType={mimetype}
                              url={
                                getPublicUrl(storageObject.name) ?? undefined
                              }
                            >
                              {mimetype.startsWith('image/') ? (
                                <div className="relative flex aspect-video w-full items-center justify-center rounded bg-neutral-gray1 text-white">
                                  <Image
                                    src={getPublicUrl(storageObject.name) ?? ''}
                                    alt={fileName}
                                    fill={true}
                                    className="size-full object-cover"
                                  />
                                </div>
                              ) : null}
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
              <hr className="bg-neutral-gray1" />
            </Fragment>
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

export const PostFeedSkeleton = ({
  className,
  numPosts = 1,
}: {
  className?: string;
  numPosts?: number;
}) => {
  return (
    <div className={cn('flex flex-col gap-8 pb-8', className)}>
      {new Array(numPosts).fill(0).map((_, i) => (
        <FeedItem key={i}>
          <AvatarSkeleton className="!size-8 max-h-8 max-w-8 rounded-full" />
          <FeedMain>
            <FeedHeader className="w-1/2">
              <Header3 className="w-full font-medium leading-5">
                <Skeleton />
              </Header3>
              <Skeleton />
            </FeedHeader>
            <FeedContent>
              <SkeletonLine lines={3} />
            </FeedContent>
          </FeedMain>
        </FeedItem>
      ))}
    </div>
  );
};
