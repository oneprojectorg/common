'use client';

import { getPublicUrl } from '@/utils';
import { OrganizationUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import { trpc } from '@op/api/client';
import type {
  Organization,
  Post,
  PostToOrganization,
  Profile,
} from '@op/api/encoders';
import { REACTION_OPTIONS } from '@op/types';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { CommentButton } from '@op/ui/CommentButton';
import { Header3 } from '@op/ui/Header';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { ReactionsButton } from '@op/ui/ReactionsButton';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { Fragment, ReactNode, useState } from 'react';
import { LuEllipsis, LuLeaf } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { DiscussionModal } from '../DiscussionModal';
import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';
import { DeletePost } from './DeletePost';

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
        'flex w-full flex-col items-start justify-start gap-2 overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const PostDisplayName = ({
  displayName,
  displaySlug,
  withLinks,
  isComment,
}: {
  displayName?: string;
  displaySlug?: string;
  withLinks: boolean;
  isComment: boolean;
}) => {
  if (!displayName) return null;

  if (withLinks && !isComment) {
    return <Link href={`/org/${displaySlug}`}>{displayName}</Link>;
  }

  return <>{displayName}</>;
};

const PostTimestamp = ({ createdAt }: { createdAt?: Date | string }) => {
  if (!createdAt) return null;

  return (
    <span className="text-sm text-neutral-gray4">
      {formatRelativeTime(createdAt)}
    </span>
  );
};

const PostContent = ({ content }: { content?: string }) => {
  if (!content) return null;

  return <>{linkifyText(content)}</>;
};

const PostAttachments = ({ attachments }: { attachments?: any[] }) => {
  if (!attachments) return null;

  return (
    <>
      {attachments.map(({ fileName, storageObject }: any) => {
        const { mimetype, size } = storageObject.metadata;

        return (
          <MediaDisplay
            key={storageObject.id}
            title={fileName}
            mimeType={mimetype}
            url={getPublicUrl(storageObject.name) ?? undefined}
            size={size}
          >
            <AttachmentImage
              mimetype={mimetype}
              fileName={fileName}
              storageObjectName={storageObject.name}
            />
          </MediaDisplay>
        );
      })}
    </>
  );
};

const AttachmentImage = ({
  mimetype,
  fileName,
  storageObjectName,
}: {
  mimetype: string;
  fileName: string;
  storageObjectName: string;
}) => {
  if (!mimetype.startsWith('image/')) return null;

  return (
    <div className="relative flex h-fit w-full items-center justify-center rounded bg-neutral-gray1 text-white">
      <Image
        src={getPublicUrl(storageObjectName) ?? ''}
        alt={fileName}
        fill={true}
        className="!relative size-full object-cover"
      />
    </div>
  );
};

const PostUrls = ({ urls }: { urls: string[] }) => {
  if (urls.length === 0) return null;

  return (
    <div>
      {urls.map((url) => (
        <LinkPreview key={url} url={url} />
      ))}
    </div>
  );
};

const PostReactions = ({
  post,
  onReactionClick,
}: {
  post: any;
  onReactionClick: (postId: string, emoji: string) => void;
}) => {
  if (!post?.id) return null;

  const reactions = post.reactionCounts
    ? Object.entries(post.reactionCounts).map(([reactionType, count]) => {
        const reactionOption = REACTION_OPTIONS.find(
          (option) => option.key === reactionType,
        );
        const emoji = reactionOption?.emoji || reactionType;

        return {
          emoji,
          count: count as number,
          isActive: post.userReaction === reactionType,
        };
      })
    : [];

  return (
    <ReactionsButton
      reactions={reactions}
      reactionOptions={REACTION_OPTIONS}
      onReactionClick={(emoji) => onReactionClick(post.id!, emoji)}
      onAddReaction={(emoji) => onReactionClick(post.id!, emoji)}
    />
  );
};

const PostCommentButton = ({
  post,
  isComment,
  onCommentClick,
}: {
  post: any;
  isComment: boolean;
  onCommentClick: () => void;
}) => {
  if (!post?.id || isComment) return null;

  return (
    <CommentButton
      count={0} // TODO: Add comment count when available in API
      onPress={onCommentClick}
    />
  );
};

const PostMenu = ({
  organization,
  post,
  user,
  isComment,
}: {
  organization: any;
  post: any;
  user?: OrganizationUser;
  isComment: boolean;
}) => {
  const canShowMenu =
    (organization?.id === user?.currentOrganization?.id ||
      (isComment && post?.profile?.id === user?.profile?.id)) &&
    post?.id;

  if (!canShowMenu) return null;

  return (
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
        <PostMenuContent
          postId={post.id}
          organizationId={organization?.id || ''}
          canDelete={organization?.id || isComment}
        />
      </Popover>
    </MenuTrigger>
  );
};

const PostMenuContent = ({
  postId,
  organizationId,
  canDelete,
}: {
  postId: string;
  organizationId: string;
  canDelete: boolean;
}) => {
  if (!canDelete) return null;

  return <DeletePost postId={postId} organizationId={organizationId} />;
};

const EmptyPostsState = () => (
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
);

const PostsList = ({
  posts,
  user,
  withLinks,
  onReactionClick,
  onCommentClick,
}: {
  posts: Array<PostToOrganization>;
  user?: OrganizationUser;
  withLinks: boolean;
  onReactionClick: (postId: string, emoji: string) => void;
  onCommentClick: (post: Post, org?: Organization | null) => void;
}) => (
  <>
    {posts.map(({ organization, post }, i) => {
      const { urls } = detectLinks(post?.content);

      // For comments (posts without organization), show the post author
      const isComment = !organization;
      const displayName = isComment
        ? post?.profile?.name
        : organization?.profile.name;
      const displaySlug = isComment
        ? post?.profile?.slug
        : organization?.profile.slug;
      const avatarData = isComment
        ? { profile: post?.profile as Profile }
        : organization;

      if (organization && post.content === 'happy wednesday everyone!') {
        console.log('ORGPOST', organization, post, displayName);
      }

      return (
        <Fragment key={i}>
          <FeedItem className="sm:px-4">
            <OrganizationAvatar
              organization={avatarData}
              withLink={withLinks && !isComment}
              className="!size-8 max-h-8 max-w-8"
            />
            <FeedMain>
              <FeedHeader className="relative w-full justify-between">
                <div className="flex items-baseline gap-2">
                  <Header3 className="font-medium leading-3">
                    <PostDisplayName
                      displayName={displayName}
                      displaySlug={displaySlug}
                      withLinks={withLinks}
                      isComment={isComment}
                    />
                  </Header3>
                  <PostTimestamp createdAt={post?.createdAt} />
                </div>
                <PostMenu
                  organization={organization}
                  post={post}
                  user={user}
                  isComment={isComment}
                />
              </FeedHeader>
              <FeedContent>
                <PostContent content={post?.content} />
                <PostAttachments attachments={post.attachments} />
                <PostUrls urls={urls} />
                <div className="flex items-center gap-2">
                  <PostReactions
                    post={post}
                    onReactionClick={onReactionClick}
                  />
                  <PostCommentButton
                    post={post}
                    isComment={isComment}
                    onCommentClick={() => onCommentClick(post, organization)}
                  />
                </div>
              </FeedContent>
            </FeedMain>
          </FeedItem>
          <hr className="bg-neutral-gray1" />
        </Fragment>
      );
    })}
  </>
);

const DiscussionModalContainer = ({
  discussionModal,
  onClose,
}: {
  discussionModal: { isOpen: boolean; post: Post; org?: Organization | null };
  onClose: () => void;
}) => {
  if (!discussionModal.isOpen || !discussionModal.post) {
    return null;
  }

  return (
    <DiscussionModal
      post={discussionModal.post}
      organization={discussionModal.org}
      isOpen={discussionModal.isOpen}
      onClose={onClose}
    />
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
  const utils = trpc.useUtils();
  const [discussionModal, setDiscussionModal] = useState<{
    isOpen: boolean;
    post: any;
    org?: Organization | null;
  }>({
    isOpen: false,
    post: null,
    org: null,
  });

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

  const handleCommentClick = (post: Post, org?: Organization) => {
    setDiscussionModal({ isOpen: true, post, org });
  };

  const handleModalClose = () => {
    setDiscussionModal({ isOpen: false, post: null, org: null });
  };

  return (
    <div className={cn('flex flex-col gap-6 pb-8', className)}>
      {posts.length > 0 ? (
        <PostsList
          posts={posts}
          user={user}
          withLinks={withLinks}
          onReactionClick={handleReactionClick}
          onCommentClick={handleCommentClick}
        />
      ) : (
        <EmptyPostsState />
      )}

      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={handleModalClose}
      />
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
