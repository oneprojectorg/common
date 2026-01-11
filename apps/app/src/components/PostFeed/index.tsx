'use client';

import { getPublicUrl } from '@/utils';
import { OrganizationUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import { trpc } from '@op/api/client';
import type { Organization, Post, PostAttachment } from '@op/api/encoders';
import { useRelativeTime } from '@op/hooks';
import { REACTION_OPTIONS } from '@op/types';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { CommentButton } from '@op/ui/CommentButton';
import { Header3 } from '@op/ui/Header';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { OptionMenu } from '@op/ui/OptionMenu';
import { ReactionsButton } from '@op/ui/ReactionsButton';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { ReactNode, memo, useCallback, useMemo, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { DiscussionModal } from '../DiscussionModal';
import { FeedContent, FeedHeader, FeedItem, FeedMain } from '../Feed';
import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';
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

const PostTimestamp = ({ createdAt }: { createdAt: Date | string }) => {
  const relativeTime = useRelativeTime(createdAt);

  return <span className="text-sm text-neutral-gray4">{relativeTime}</span>;
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
  // we can disable this to allow for threads in the future
  if (!post?.id || post.parentPostId) {
    return null;
  }

  return (
    <CommentButton count={post.commentCount || 0} onPress={onCommentClick} />
  );
};

const PostMenu = ({
  organization,
  post,
  user,
}: {
  organization?: Organization | null;
  post: Post;
  user?: OrganizationUser;
}) => {
  // We check against whether this is the user's post, or whether the org that it was posted to currently matches the user's context
  const canShowMenu =
    (post?.profileId === user?.currentProfileId ||
      (organization && organization?.profile.id === user?.currentProfileId)) &&
    !!post?.id;

  if (!canShowMenu) {
    return null;
  }

  return (
    <OptionMenu className="right-0 top-0 absolute">
      <PostMenuContent
        post={post}
        profileId={user?.currentProfileId || ''}
        canDelete={canShowMenu}
      />
    </OptionMenu>
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

export const EmptyPostsState = () => {
  const t = useTranslations();

  return (
    <FeedItem>
      <FeedMain className="py-6 flex w-full flex-col items-center justify-center">
        <FeedContent className="flex flex-col items-center justify-center text-neutral-gray4">
          <div className="size-10 gap-4 flex items-center justify-center rounded-full bg-neutral-gray1">
            <LuLeaf />
          </div>
          <span>{t('No posts yet')}</span>
        </FeedContent>
      </FeedMain>
    </FeedItem>
  );
};

/**
 * Hook for optimistic reaction updates with server sync.
 * Returns displayPost with optimistic reaction data and a handleReactionClick function.
 * TODO: stopgap until we have server channels in place for updates
 */
const useOptimisticReaction = (
  post: Post,
  onReactionClick: (postId: string, emoji: string) => void,
) => {
  const [localReaction, setLocalReaction] = useState({
    userReaction: post.userReaction ?? null,
    reactionCounts: post.reactionCounts ?? {},
  });

  // Sync pattern: setState during render is intentional to avoid extra render cycle.
  // This syncs local state when server data changes (after refetch).
  // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const serverReactionKey = `${post.userReaction}-${JSON.stringify(post.reactionCounts)}`;
  const [lastServerKey, setLastServerKey] = useState(serverReactionKey);
  if (serverReactionKey !== lastServerKey) {
    setLastServerKey(serverReactionKey);
    setLocalReaction({
      userReaction: post.userReaction ?? null,
      reactionCounts: post.reactionCounts ?? {},
    });
  }

  const updateReaction = useCallback((reactionType: string) => {
    setLocalReaction((current) => {
      const newCounts = { ...current.reactionCounts };

      if (current.userReaction === reactionType) {
        // Removing the reaction
        const newCount = Math.max(0, (newCounts[reactionType] || 1) - 1);
        if (newCount === 0) {
          delete newCounts[reactionType];
        } else {
          newCounts[reactionType] = newCount;
        }
        return { userReaction: null, reactionCounts: newCounts };
      } else {
        // Adding or replacing reaction
        if (current.userReaction) {
          // Remove previous reaction count
          const prevCount = Math.max(
            0,
            (newCounts[current.userReaction] || 1) - 1,
          );
          if (prevCount === 0) {
            delete newCounts[current.userReaction];
          } else {
            newCounts[current.userReaction] = prevCount;
          }
        }
        // Add new reaction count
        newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
        return { userReaction: reactionType, reactionCounts: newCounts };
      }
    });
  }, []);

  const handleReactionClick = useCallback(
    (postId: string, emoji: string) => {
      const reactionOption = REACTION_OPTIONS.find(
        (option) => option.emoji === emoji,
      );
      if (reactionOption?.key) {
        updateReaction(reactionOption.key);
      }
      onReactionClick(postId, emoji);
    },
    [onReactionClick, updateReaction],
  );

  const displayPost = useMemo(
    () => ({
      ...post,
      userReaction: localReaction.userReaction,
      reactionCounts: localReaction.reactionCounts,
    }),
    [post, localReaction],
  );

  return { displayPost, handleReactionClick };
};

export const PostItem = ({
  post,
  organization,
  user,
  withLinks,
  onReactionClick,
  onCommentClick,
  className,
}: {
  post: Post;
  organization: Organization | null;
  user?: OrganizationUser;
  withLinks: boolean;
  onReactionClick: (postId: string, emoji: string) => void;
  onCommentClick?: (post: Post, organization: Organization | null) => void;
  className?: string;
}) => {
  const { urls } = useMemo(() => detectLinks(post?.content), [post?.content]);
  const { displayPost, handleReactionClick } = useOptimisticReaction(
    post,
    onReactionClick,
  );

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
          <div className="gap-2 flex items-baseline">
            <Header3 className="font-semibold leading-3">
              <PostDisplayName
                displayName={displayName}
                displaySlug={displaySlug}
                withLinks={withLinks}
              />
            </Header3>
            {post.createdAt ? (
              <PostTimestamp createdAt={post.createdAt} />
            ) : null}
          </div>
          <PostMenu post={post} user={user} organization={organization} />
        </FeedHeader>
        <FeedContent>
          <PostContent content={post?.content} />
          <PostAttachments attachments={post.attachments} />
          <PostUrls urls={urls} />
          <div className="gap-2 flex items-center justify-between">
            <PostReactions
              post={displayPost}
              onReactionClick={handleReactionClick}
            />
            {onCommentClick ? (
              <PostCommentButton
                post={post}
                onCommentClick={() => onCommentClick(post, organization)}
              />
            ) : null}
          </div>
        </FeedContent>
      </FeedMain>
    </FeedItem>
  );
};

export const PostItemOnDetailPage = ({
  post,
  organization,
  user,
  withLinks,
  onReactionClick,
  commentCount,
  className,
}: {
  post: Post;
  organization: Organization | null;
  user?: OrganizationUser;
  withLinks: boolean;
  onReactionClick: (postId: string, emoji: string) => void;
  commentCount: number;
  className?: string;
}) => {
  const { urls } = useMemo(() => detectLinks(post?.content), [post?.content]);
  const { displayPost, handleReactionClick } = useOptimisticReaction(
    post,
    onReactionClick,
  );

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
          <div className="gap-2 flex items-baseline">
            <Header3 className="font-semibold leading-3">
              <PostDisplayName
                displayName={displayName}
                displaySlug={displaySlug}
                withLinks={withLinks}
              />
            </Header3>
            {post.createdAt ? (
              <PostTimestamp createdAt={post.createdAt} />
            ) : null}
          </div>
          <PostMenu post={post} user={user} organization={organization} />
        </FeedHeader>
        <FeedContent>
          <PostContent content={post?.content} />
          <PostAttachments attachments={post.attachments} />
          <PostUrls urls={urls} />
          <div className="gap-2 flex items-center justify-between">
            <PostReactions
              post={displayPost}
              onReactionClick={handleReactionClick}
            />
            <CommentButton count={commentCount} isDisabled />
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
    post?: Post | null;
    organization?: Organization | null;
  };
  onClose: () => void;
}) => {
  if (!discussionModal.isOpen || !discussionModal.post) {
    return null;
  }

  return (
    <DiscussionModal
      post={discussionModal.post}
      organization={discussionModal.organization ?? null}
      isOpen={discussionModal.isOpen}
      onClose={onClose}
    />
  );
};

export const usePostFeedActions = () => {
  const [discussionModal, setDiscussionModal] = useState<{
    isOpen: boolean;
    post?: Post | null;
    organization?: Organization | null;
  }>({
    isOpen: false,
    post: null,
    organization: null,
  });

  const utils = trpc.useUtils();
  const toggleReaction = trpc.organization.toggleReaction.useMutation({
    onSettled: () => {
      void utils.organization.listPosts.invalidate();
      void utils.organization.listAllPosts.invalidate();
      void utils.posts.getPosts.invalidate();
    },
    onError: (err) => {
      toast.error({ message: err.message || 'Failed to update reaction' });
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

  const handleCommentClick = (
    post: Post,
    organization: Organization | null,
  ) => {
    setDiscussionModal({ isOpen: true, post, organization });
  };

  const handleModalClose = () => {
    setDiscussionModal({ isOpen: false, post: null, organization: null });
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
    <div className={cn('gap-4 pb-8 flex flex-col', className)}>{children}</div>
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
    <div className={cn('gap-8 pb-8 flex flex-col', className)}>
      {new Array(numPosts).fill(0).map((_, i) => (
        <FeedItem key={i}>
          <AvatarSkeleton className="!size-8 max-h-8 max-w-8 rounded-full" />
          <FeedMain>
            <FeedHeader className="w-1/2">
              <Header3 className="pb-1 font-medium leading-5 w-full">
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
