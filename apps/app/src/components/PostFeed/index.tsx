'use client';

import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type {
  CommonUser,
  Organization,
  Post,
  PostAttachment,
} from '@op/api/encoders';
import { useRelativeTime } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { CommentButton } from '@op/sense/CommentButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Header3 } from '@op/sense/Header';
import { MediaDisplay } from '@op/sense/MediaDisplay';
import { ReactionsButton } from '@op/sense/ReactionsButton';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Sonner';
import { cn } from '@op/sense/lib/utils';
import { REACTION_OPTIONS } from '@op/types';
import Image from 'next/image';
import { ReactNode, memo, useCallback, useMemo, useState } from 'react';
import { LuEllipsis, LuFlag, LuLeaf } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { useDecisionTranslation } from '@/components/decisions/DecisionTranslationContext';

import { DiscussionModal } from '../DiscussionModal';
import { FeedContent, FeedHeader, FeedItem, FeedMain } from '../Feed';
import { LinkPreview } from '../LinkPreview';
import { OrganizationAvatar } from '../OrganizationAvatar';
import { DeletePostMenuItem } from './DeletePostMenuItem';
import { ReportPostModal } from './ReportPostModal';

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
    return (
      <Link href={`/org/${displaySlug}`}>
        <bdi>{displayName}</bdi>
      </Link>
    );
  }

  return <bdi>{displayName}</bdi>;
};

const PostTimestamp = ({ createdAt }: { createdAt: Date | string }) => {
  const relativeTime = useRelativeTime(createdAt);

  return <span className="text-sm text-neutral-gray4">{relativeTime}</span>;
};

const PostContent = ({ content }: { content?: string }) => {
  if (!content) {
    return null;
  }

  return (
    <p dir="auto" className="whitespace-pre-wrap">
      {linkifyText(content)}
    </p>
  );
};

// Only the author and admins ever receive a flagged post/comment — everyone
// else has it filtered out server-side — so this indicator marks content that
// is hidden from general readers while moderation is pending/upheld.
const PostFlaggedIndicator = ({ post }: { post: Post }) => {
  const t = useTranslations();

  if (!post.isFlagged) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-sm text-functional-red">
      <LuFlag className="size-4" />
      <span>{t('Flagged')}</span>
    </div>
  );
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
    const mimetype = storageObject.metadata?.mimetype;
    const size = storageObject.metadata?.size;

    return (
      <MediaDisplay
        key={storageObject.id}
        title={fileName}
        mimeType={mimetype}
        url={getPublicUrl(storageObject.name) ?? undefined}
        size={size}
      >
        <AttachmentImage
          mimetype={mimetype ?? ''}
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
  const { user } = useUser();
  const canReact = userCanInteract(user);

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
      canReact={canReact}
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
  const t = useTranslations();

  // we can disable this to allow for threads in the future
  if (!post?.id || post.parentPostId) {
    return null;
  }

  const count = post.commentCount || 0;

  return (
    <CommentButton
      count={count}
      label={t('{count} comments', { count })}
      onClick={onCommentClick}
    />
  );
};

const PostMenu = ({
  organization,
  post,
  user,
}: {
  organization?: Organization | null;
  post: Post;
  user?: CommonUser;
}) => {
  const t = useTranslations();
  const { getPermissionsForProfile } = useUser();
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Author, current org context owner, or a profile admin on the post's
  // root profile (mirrors deletePostById's server-side auth) — only these
  // callers get the moderation options like Delete.
  const isProfileAdmin = post.rootProfileId
    ? getPermissionsForProfile(post.rootProfileId).profile.admin
    : false;
  const canModerate =
    post.profileId === user?.currentProfileId ||
    (organization && organization.profile.id === user?.currentProfileId) ||
    isProfileAdmin;

  if (!post.id) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('Post options')}
              className="absolute end-0 top-0 aspect-square aria-expanded:bg-neutral-gray1"
            >
              <LuEllipsis className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent side="bottom" align="end" className="min-w-28">
          {canModerate ? <DeletePostMenuItem post={post} /> : null}
          <DropdownMenuItem onClick={() => setIsReportOpen(true)}>
            {t('Report')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportPostModal
        postId={post.id}
        isOpen={isReportOpen}
        onOpenChange={setIsReportOpen}
      />
    </>
  );
};

export const EmptyPostsState = () => {
  const t = useTranslations();

  return (
    <FeedItem>
      <FeedMain className="flex w-full flex-col items-center justify-center py-6">
        <FeedContent className="flex flex-col items-center justify-center text-neutral-gray4">
          <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
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
  user?: CommonUser;
  withLinks: boolean;
  onReactionClick: (postId: string, emoji: string) => void;
  onCommentClick?: (post: Post, organization: Organization | null) => void;
  className?: string;
}) => {
  const decisionTranslation = useDecisionTranslation();
  const translatedContent = decisionTranslation?.posts[post.id]?.content;
  const displayContent = translatedContent ?? post?.content;
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
          <div className="flex flex-col items-baseline gap-2">
            <Header3 className="font-sans text-base leading-3 font-normal">
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
          <PostFlaggedIndicator post={post} />
          <PostContent content={displayContent} />
          <PostAttachments attachments={post.attachments} />
          <PostUrls urls={urls} />
          <div className="flex items-center justify-between gap-2">
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
  user?: CommonUser;
  withLinks: boolean;
  onReactionClick: (postId: string, emoji: string) => void;
  commentCount: number;
  className?: string;
}) => {
  const t = useTranslations();
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
          <div className="flex items-baseline gap-2">
            <Header3 className="font-sans leading-3 font-semibold">
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
          <PostFlaggedIndicator post={post} />
          <PostContent content={post?.content} />
          <PostAttachments attachments={post.attachments} />
          <PostUrls urls={urls} />
          <div className="flex items-center justify-between gap-2">
            <PostReactions
              post={displayPost}
              onReactionClick={handleReactionClick}
            />
            <CommentButton
              count={commentCount}
              label={t('{count} comments', { count: commentCount })}
              disabled
            />
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
  const t = useTranslations();
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
      void utils.posts.listProfilePosts.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t('Failed to update reaction'));
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
    <div className={cn('flex flex-col gap-8 pb-8', className)}>{children}</div>
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
          <Skeleton className="!size-8 max-h-8 max-w-8 rounded-full" />
          <FeedMain>
            <FeedHeader className="w-1/2">
              <Header3 className="w-full pb-1 font-sans leading-5 font-medium">
                <Skeleton className="h-4 w-full" />
              </Header3>
              <Skeleton className="h-4 w-full" />
            </FeedHeader>
            <FeedContent>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </FeedContent>
          </FeedMain>
        </FeedItem>
      ))}
    </div>
  );
};
