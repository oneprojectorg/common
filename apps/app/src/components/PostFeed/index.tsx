'use client';

import { getPublicUrl } from '@/utils';
import { createOptimisticUpdater, type PostFeedUser } from '@/utils/optimisticUpdates';
import { OrganizationUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import type {
  Organization,
  Post,
  PostAttachment,
  PostToOrganization,
} from '@op/api/encoders';
import { REACTION_OPTIONS } from '@op/types';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { CommentButton } from '@op/ui/CommentButton';
import { Header3 } from '@op/ui/Header';
import { IconButton } from '@op/ui/IconButton';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { ReactionsButton } from '@op/ui/ReactionsButton';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { ReactNode, memo, useMemo, useState } from 'react';
import { LuEllipsis, LuLeaf } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { DiscussionModal } from '../DiscussionModal';
import { FeedContent, FeedHeader, FeedItem, FeedMain } from '../Feed';
import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';
import { formatRelativeTime } from '../utils';
import { DeletePost } from './DeletePost';

const PostDisplayName = ({
  displayName,
  displaySlug,
  withLinks,
}: {
  displayName?: string;
  displaySlug?: string;
  withLinks: boolean;
}) => {
  if (!displayName) return null;

  if (withLinks) {
    return <Link href={`/org/${displaySlug}`}>{displayName}</Link>;
  }

  return <>{displayName}</>;
};

const PostTimestamp = ({ createdAt }: { createdAt?: Date | string | null }) => {
  if (!createdAt) {
    return null;
  }

  return (
    <span className="text-sm text-neutral-gray4">
      {formatRelativeTime(createdAt)}
    </span>
  );
};

const PostContent = ({ content }: { content?: string }) => {
  if (!content) {
    return null;
  }

  return linkifyText(content);
};

const PostAttachments = ({
  attachments,
}: {
  attachments?: PostAttachment[];
}) => {
  if (!attachments) {
    return null;
  }

  return attachments.map(({ fileName, storageObject }) => {
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
  });
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

const PostUrls = memo(({ urls }: { urls: string[] }) => {
  if (urls.length === 0) {
    return null;
  }

  return (
    <div>
      {urls.map((url) => (
        <LinkPreview key={url} url={url} />
      ))}
    </div>
  );
});

PostUrls.displayName = 'PostUrls';

const PostReactions = ({
  post,
  onReactionClick,
}: {
  post: Post;
  onReactionClick: (postId: string, emoji: string) => void;
}) => {
  if (!post?.id) return null;

  const reactions = post.reactionCounts
    ? Object.entries(post.reactionCounts).map(([reactionType, count]) => {
      const reactionOption = REACTION_OPTIONS.find(
        (option) => option.key === reactionType,
      );
      const emoji = reactionOption?.emoji || reactionType;
      const users = post.reactionUsers?.[reactionType] || [];

      return {
        emoji,
        count: count as number,
        isActive: post.userReaction === reactionType,
        users,
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
  onCommentClick,
}: {
  post: Post;
  onCommentClick: () => void;
}) => {
  const commentsEnabled = useFeatureFlagEnabled('comments');

  // we can disable this to allow for threads in the future
  if (!commentsEnabled || !post?.id || post.parentPostId) {
    return null;
  }

  return (
    <CommentButton count={post.commentCount || 0} onPress={onCommentClick} />
  );
};

const PostMenu = ({
  post,
  user,
}: {
  organization?: Organization;
  post: Post;
  user?: OrganizationUser;
}) => {
  const canShowMenu = post?.profileId === user?.currentProfileId && !!post?.id;

  if (!canShowMenu) {
    return null;
  }

  return (
    <MenuTrigger>
      <IconButton
        variant="ghost"
        size="small"
        className="absolute right-0 top-0 aria-expanded:bg-neutral-gray1"
      >
        <LuEllipsis className="size-4" />
      </IconButton>
      <Popover placement="bottom end">
        <PostMenuContent
          post={post}
          profileId={user?.currentProfileId || ''}
          canDelete={canShowMenu}
        />
      </Popover>
    </MenuTrigger>
  );
};

const PostMenuContent = ({
  post,
  profileId,
  canDelete,
}: {
  post: Post;
  profileId: string;
  canDelete: boolean;
}) => {
  if (!canDelete) {
    return null;
  }

  return <DeletePost post={post} profileId={profileId} />;
};

export const EmptyPostsState = () => (
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

export const PostItem = ({
  postToOrg,
  user,
  withLinks,
  onReactionClick,
  onCommentClick,
  className,
}: {
  postToOrg: PostToOrganization;
  user?: OrganizationUser;
  withLinks: boolean;
  onReactionClick: (postId: string, emoji: string) => void;
  onCommentClick?: (post: PostToOrganization) => void;
  className?: string;
}) => {
  const { organization, post } = postToOrg;
  const { urls } = useMemo(() => detectLinks(post?.content), [post?.content]);

  // For comments (posts without organization), show the post author
  // TODO: this is too complex. We need to refactor this
  const displayName =
    post?.profile?.name ?? organization?.profile.name ?? 'Unknown User';
  const displaySlug =
    post?.profile?.slug ?? organization?.profile.slug ?? 'Unknown User';
  const profile = post.profile ?? organization?.profile;

  return (
    <FeedItem className={cn('sm:px-4', className)}>
      <OrganizationAvatar
        profile={profile}
        withLink={withLinks}
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
              />
            </Header3>
            <PostTimestamp createdAt={post?.createdAt} />
          </div>
          <PostMenu post={post} user={user} />
        </FeedHeader>
        <FeedContent>
          <PostContent content={post?.content} />
          <PostAttachments attachments={post.attachments} />
          <PostUrls urls={urls} />
          <div className="flex items-center justify-between gap-2">
            <PostReactions post={post} onReactionClick={onReactionClick} />
            {onCommentClick ? (
              <PostCommentButton
                post={post}
                onCommentClick={() => onCommentClick(postToOrg)}
              />
            ) : null}
          </div>
        </FeedContent>
      </FeedMain>
    </FeedItem>
  );
};

export const DiscussionModalContainer = ({
  discussionModal,
  onClose,
}: {
  discussionModal: {
    isOpen: boolean;
    post?: PostToOrganization | null;
  };
  onClose: () => void;
}) => {
  if (!discussionModal.isOpen || !discussionModal.post) {
    return null;
  }

  return (
    <DiscussionModal
      postToOrg={discussionModal.post}
      isOpen={discussionModal.isOpen}
      onClose={onClose}
    />
  );
};

export const usePostFeedActions = ({
  slug,
  limit = 20,
  parentPostId,
  profileId,
  user,
}: {
  slug?: string;
  limit?: number;
  parentPostId?: string;
  profileId?: string;
  user?: PostFeedUser;
} = {}) => {
  const utils = trpc.useUtils();
  const [discussionModal, setDiscussionModal] = useState<{
    isOpen: boolean;
    post?: PostToOrganization | null;
  }>({
    isOpen: false,
    post: null,
  });

  const toggleReaction = trpc.organization.toggleReaction.useMutation({
    onMutate: async ({ postId, reactionType }) => {
      // Cancel any outgoing refetches
      if (slug) {
        await utils.organization.listPosts.cancel({ slug, limit });
      }
      await utils.organization.listAllPosts.cancel({});

      // Cancel comments cache if we're in a modal context
      if (parentPostId) {
        const commentsQueryKey = createCommentsQueryKey(parentPostId, profileId);
        await utils.posts.getPosts.cancel(commentsQueryKey);
      }

      // Cancel profile posts cache if we're working with profile posts
      let previousProfilePosts;
      if (profileId) {
        const profileQueryKey = {
          profileId,
          parentPostId: null,
          limit: 50,
          offset: 0,
          includeChildren: false,
        };
        await utils.posts.getPosts.cancel(profileQueryKey);
        previousProfilePosts = utils.posts.getPosts.getData(profileQueryKey);
      }

      // Snapshot the previous values
      const previousListPosts = slug
        ? utils.organization.listPosts.getInfiniteData({ slug, limit })
        : undefined;
      const previousListAllPosts = utils.organization.listAllPosts.getData({});
      const previousComments = parentPostId
        ? utils.posts.getPosts.getData(createCommentsQueryKey(parentPostId, profileId))
        : undefined;

      // Use optimistic updater service for cleaner code
      const optimisticUpdater = createOptimisticUpdater(user);
      const updatePostReactions = (item: PostToOrganization) =>
        optimisticUpdater.updatePostReactions(item, postId, reactionType);

      // Optimistically update listPosts cache (if slug is provided)
      if (slug) {
        utils.organization.listPosts.setInfiniteData({ slug, limit }, (old) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map(updatePostReactions),
            })),
          };
        });
      }

      // Optimistically update listAllPosts cache
      utils.organization.listAllPosts.setData({}, (old) => {
        if (!old) {
          return old;
        }

        return {
          ...old,
          items: old.items.map(updatePostReactions),
        };
      });

      // Optimistically update profile posts cache (for proposal comments)
      if (profileId) {
        const profileQueryKey = {
          profileId,
          parentPostId: null,
          limit: 50,
          offset: 0,
          includeChildren: false,
        };
        utils.posts.getPosts.setData(profileQueryKey, (old) => {
          if (!old) {
            return old;
          }

          // Transform posts to PostToOrganization format and apply updates
          return old.map((post) => {
            const postToOrg: PostToOrganization = {
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
              deletedAt: null,
              postId: post.id,
              organizationId: '',
              post: post,
              organization: null,
            };

            const updated = updatePostReactions(postToOrg);
            return updated.post;
          });
        });
      }

      // Optimistically update comments cache if we're in a modal context
      if (parentPostId) {
        const commentsQueryKey = createCommentsQueryKey(parentPostId, profileId);
        utils.posts.getPosts.setData(commentsQueryKey, (old) => {
          if (!old) {
            return old;
          }

          // Transform comments to PostToOrganization format and apply updates
          return old.map((comment) => {
            const postToOrg: PostToOrganization = {
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt,
              deletedAt: null,
              postId: comment.id,
              organizationId: '',
              post: comment,
              organization: null,
            };

            const updated = updatePostReactions(postToOrg);
            return updated.post;
          });
        });
      }

      return { previousListPosts, previousListAllPosts, previousComments, previousProfilePosts };
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
      if (context?.previousComments && parentPostId) {
        const commentsQueryKey = createCommentsQueryKey(parentPostId, profileId);
        utils.posts.getPosts.setData(
          commentsQueryKey,
          context.previousComments,
        );
      }
      if (context?.previousProfilePosts && profileId) {
        const profileQueryKey = {
          profileId,
          parentPostId: null,
          limit: 50,
          offset: 0,
          includeChildren: false,
        };
        utils.posts.getPosts.setData(profileQueryKey, context.previousProfilePosts);
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

  const handleCommentClick = (post: PostToOrganization) => {
    setDiscussionModal({ isOpen: true, post });
  };

  const handleModalClose = () => {
    setDiscussionModal({ isOpen: false, post: null });
  };

  return {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  };
};

export const PostFeed = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn('flex flex-col gap-4 pb-8', className)}>{children}</div>
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
