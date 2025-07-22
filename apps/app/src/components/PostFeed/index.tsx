'use client';

import { getPublicUrl } from '@/utils';
import { OrganizationUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import { trpc } from '@op/api/client';
import type { PostToOrganization } from '@op/api/encoders';
import { REACTION_OPTIONS } from '@op/types';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { ReactionsButton } from '@op/ui/ReactionsButton';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { Fragment, ReactNode, useState } from 'react';
import { LuEllipsis, LuLeaf, LuMessageCircle } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { CommentModal } from '../CommentModal';
import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';
import { DeletePost } from './DeletePost';

const CommentButton = ({
  commentCount,
  onCommentClick,
}: {
  commentCount: number;
  onCommentClick: () => void;
}) => {
  return (
    <Button
      variant="icon"
      size="small"
      onPress={onCommentClick}
      className="bg-neutral-offwhite flex items-center gap-1 rounded px-2 py-1 text-neutral-gray4 transition-colors hover:bg-neutral-gray1 hover:text-neutral-charcoal"
    >
      <LuMessageCircle className="size-4" />
      <span className="text-xs font-normal">
        {commentCount === 1 ? '1 comment' : `${commentCount} comments`}
      </span>
    </Button>
  );
};

// TODO: generated this quick with AI. refactor it!
export const formatRelativeTime = (
  timestamp: Date | string | number,
): string => {
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
  return <div className={cn('flex gap-2', className)}>{children}</div>;
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
      className={cn(
        'flex w-full flex-col gap-2 leading-6 [&>.mediaItem:first-child]:mt-2',
        className,
      )}
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
    <span className={cn('flex items-center gap-2 align-baseline', className)}>
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
        'flex w-full flex-col items-start justify-start gap-0 overflow-hidden',
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
  slug,
  limit = 20,
}: {
  posts: Array<PostToOrganization>;
  user?: OrganizationUser;
  className?: string;
  withLinks?: boolean;
  slug?: string;
  limit?: number;
}) => {
  const reactionsEnabled = useFeatureFlagEnabled('reactions');
  const utils = trpc.useUtils();
  const [openCommentModals, setOpenCommentModals] = useState<
    Record<string, boolean>
  >({});

  const toggleReaction = trpc.organization.toggleReaction.useMutation({
    onMutate: async ({ postId, reactionType }) => {
      // Cancel any outgoing refetches
      if (slug) {
        await utils.organization.listPosts.cancel({ slug, limit });
      }
      await utils.organization.listAllPosts.cancel({});

      // Snapshot the previous values
      const previousListPosts = slug
        ? utils.organization.listPosts.getInfiniteData({ slug, limit })
        : undefined;
      const previousListAllPosts = utils.organization.listAllPosts.getData({});

      // Helper function to update post reactions
      const updatePostReactions = (item: any) => {
        if (item.post.id === postId) {
          const currentReaction = item.post.userReaction;
          const currentCounts = item.post.reactionCounts || {};

          // Check if user already has this reaction
          const hasReaction = currentReaction === reactionType;

          if (hasReaction) {
            // Remove reaction
            return {
              ...item,
              post: {
                ...item.post,
                userReaction: null,
                reactionCounts: {
                  ...currentCounts,
                  [reactionType]: Math.max(
                    0,
                    (currentCounts[reactionType] || 0) - 1,
                  ),
                },
              },
            };
          } else {
            // Replace or add reaction
            const newCounts = { ...currentCounts };

            // If user had a previous reaction, decrement its count
            if (currentReaction) {
              newCounts[currentReaction] = Math.max(
                0,
                (newCounts[currentReaction] || 0) - 1,
              );
            }

            // Increment count for new reaction
            newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;

            return {
              ...item,
              post: {
                ...item.post,
                userReaction: reactionType,
                reactionCounts: newCounts,
              },
            };
          }
        }
        return item;
      };

      // Optimistically update listPosts cache (if slug is provided)
      if (slug) {
        utils.organization.listPosts.setInfiniteData(
          { slug, limit },
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                items: page.items.map(updatePostReactions),
              })),
            };
          },
        );
      }

      // Optimistically update listAllPosts cache
      utils.organization.listAllPosts.setData({}, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map(updatePostReactions),
        };
      });

      return { previousListPosts, previousListAllPosts };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousListPosts && slug) {
        utils.organization.listPosts.setInfiniteData(
          { slug, limit },
          context.previousListPosts,
        );
      }
      if (context?.previousListAllPosts) {
        utils.organization.listAllPosts.setData(
          {},
          context.previousListAllPosts,
        );
      }
      toast.error({ message: err.message || 'Failed to update reaction' });
    },
    onSuccess: () => {
      // Skip invalidation to preserve optimistic updates
      // The optimistic update should be accurate enough
    },
  });

  const handleReactionClick = (postId: string, emoji: string) => {
    // Convert emoji to reaction type using REACTION_OPTIONS
    const reactionOption = REACTION_OPTIONS.find(
      (option) => option.emoji === emoji,
    );
    const reactionType = reactionOption?.key;

    if (!reactionType) {
      console.error('Unknown emoji:', emoji);
      return;
    }

    toggleReaction.mutate({ postId, reactionType });
  };

  const openCommentModal = (postId: string) => {
    setOpenCommentModals((prev) => ({ ...prev, [postId]: true }));
  };

  const closeCommentModal = (postId: string) => {
    setOpenCommentModals((prev) => ({ ...prev, [postId]: false }));
  };

  return (
    <div className={cn('flex flex-col gap-6 pb-8', className)}>
      {posts.length > 0 ? (
        posts.map(({ organization, post }, i) => {
          const { urls } = detectLinks(post?.content);

          return (
            <Fragment key={i}>
              <FeedItem className="sm:px-4">
                <OrganizationAvatar
                  organization={organization}
                  withLink={withLinks}
                  className="!size-8 max-h-8 max-w-8"
                />
                <FeedMain>
                  <FeedHeader className="relative w-full justify-between">
                    <div className="flex items-baseline gap-2">
                      <Header3 className="font-medium leading-3">
                        {withLinks ? (
                          <Link href={`/org/${organization?.profile.slug}`}>
                            {organization?.profile.name}
                          </Link>
                        ) : (
                          organization?.profile.name
                        )}
                      </Header3>
                      {post?.createdAt ? (
                        <span className="text-sm text-neutral-gray4">
                          {formatRelativeTime(post?.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    {organization?.id === user?.currentOrganization?.id &&
                      post?.id && (
                        <MenuTrigger>
                          <Button
                            unstyled
                            color="neutral"
                            variant="icon"
                            size="small"
                            className="absolute right-0 top-0 size-6 rounded-full border-0 bg-white p-1 outline-0 aria-expanded:bg-neutral-gray1"
                          >
                            <LuEllipsis className="size-4" />
                          </Button>
                          <Popover placement="bottom end">
                            {post?.id && organization?.id ? (
                              <DeletePost
                                postId={post.id}
                                organizationId={organization.id}
                              />
                            ) : null}
                          </Popover>
                        </MenuTrigger>
                      )}
                  </FeedHeader>
                  <FeedContent>
                    {post?.content ? linkifyText(post.content) : null}
                    {post.attachments
                      ? post.attachments.map(({ fileName, storageObject }) => {
                          const { mimetype, size } = storageObject.metadata;

                          return (
                            <MediaDisplay
                              key={storageObject.id}
                              title={fileName}
                              mimeType={mimetype}
                              url={
                                getPublicUrl(storageObject.name) ?? undefined
                              }
                              size={size}
                            >
                              {mimetype.startsWith('image/') ? (
                                <div className="relative flex h-fit w-full items-center justify-center rounded bg-neutral-gray1 text-white">
                                  <Image
                                    src={getPublicUrl(storageObject.name) ?? ''}
                                    alt={fileName}
                                    fill={true}
                                    className="!relative size-full object-cover"
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
                    <div className="flex items-center gap-3">
                      {reactionsEnabled && post?.id && (
                        <ReactionsButton
                          reactions={
                            post.reactionCounts
                              ? Object.entries(post.reactionCounts).map(
                                  ([reactionType, count]) => {
                                    // Convert reaction type to emoji
                                    const reactionOption =
                                      REACTION_OPTIONS.find(
                                        (option) => option.key === reactionType,
                                      );
                                    const emoji =
                                      reactionOption?.emoji || reactionType;

                                    return {
                                      emoji,
                                      count,
                                      isActive:
                                        post.userReaction === reactionType,
                                    };
                                  },
                                )
                              : []
                          }
                          reactionOptions={REACTION_OPTIONS}
                          onReactionClick={(emoji) => {
                            handleReactionClick(post.id!, emoji);
                          }}
                          onAddReaction={(emoji) => {
                            handleReactionClick(post.id!, emoji);
                          }}
                        />
                      )}
                      {post?.id && (
                        <CommentButton
                          commentCount={post.commentCount || 0}
                          onCommentClick={() => openCommentModal(post.id!)}
                        />
                      )}
                    </div>
                  </FeedContent>
                </FeedMain>
              </FeedItem>
              <hr className="bg-neutral-gray1" />
              {post?.id && openCommentModals[post.id] && (
                <CommentModal
                  isOpen={!!openCommentModals[post.id]}
                  onClose={() => closeCommentModal(post.id!)}
                  post={{
                    id: post.id,
                    content: post.content || '',
                    createdAt: new Date(post.createdAt || Date.now()),
                  }}
                  user={user}
                />
              )}
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
              <Header3 className="w-full pb-1 font-medium leading-5">
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
