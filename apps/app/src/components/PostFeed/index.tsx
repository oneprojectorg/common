'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { detectLinks, linkifyText } from '@/utils/linkDetection';
import { applyLikeToggle } from '@/utils/optimisticUpdates';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type {
  CommonUser,
  Organization,
  Post,
  PostAttachment,
  Profile,
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
import { LikeButton } from '@op/sense/LikeButton';
import { MediaDisplay } from '@op/sense/MediaDisplay';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
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
  profile,
  displayName,
  withLinks,
}: {
  profile?: Profile;
  displayName?: string;
  withLinks: boolean;
}) => {
  const canLinkToProfile = useCanLinkToProfile();

  if (!displayName) return null;

  const slug = profile?.slug;
  // Match the avatar: only network members can reach profile pages, so
  // everyone else sees the name as plain text.
  const linked = withLinks && canLinkToProfile && Boolean(slug);

  if (linked) {
    const href = profile?.type === 'org' ? `/org/${slug}` : `/profile/${slug}`;

    return (
      <Link href={href}>
        <bdi>{displayName}</bdi>
      </Link>
    );
  }

  return <bdi>{displayName}</bdi>;
};

const PostTimestamp = ({ createdAt }: { createdAt: Date | string }) => {
  const relativeTime = useRelativeTime(createdAt);

  return <span className="text-sm text-muted-foreground">{relativeTime}</span>;
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
    <div className="flex items-center gap-1 text-sm text-destructive">
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
    <div className="relative flex h-fit w-full items-center justify-center rounded bg-secondary text-white">
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

const PostLikeButton = ({
  post,
  onLikeClick,
}: {
  post: Post;
  // The optimistic layer above owns the rollback, so the button itself only
  // needs to report the click.
  onLikeClick: (postId: string) => void;
}) => {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useUser();

  if (!post?.id) return null;

  const { id: postId, likeCount } = post;

  return (
    <LikeButton
      count={likeCount}
      label={t('{count} likes', { count: likeCount })}
      isLiked={post.userHasLiked}
      tooltip={formatLikerTooltip({
        likeUsers: post.likeUsers,
        likeCount,
        locale,
        t,
      })}
      canLike={userCanInteract(user)}
      onClick={() => onLikeClick(postId)}
    />
  );
};

/**
 * Names the most recent likers for the hover tooltip. Lives here rather than in
 * `@op/sense` because joining names is locale-specific and the design system has
 * no translations. The overflow count comes off `likeCount`, since the payload
 * only names the newest few.
 */
const formatLikerTooltip = ({
  likeUsers,
  likeCount,
  locale,
  t,
}: {
  likeUsers: Post['likeUsers'];
  likeCount: number;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) => {
  const named = likeUsers.map((liker) => liker.name).slice(0, 2);

  if (named.length === 0) {
    return null;
  }

  const others = Math.max(0, likeCount - named.length);

  // The overflow goes in as a list item so ListFormat owns every separator and
  // the conjunction — appending "and N others" ourselves would double the "and"
  // the formatter already inserted.
  return new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  }).format(
    others > 0 ? [...named, t('{count} others', { count: others })] : named,
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
              className="absolute end-0 top-0 aspect-square aria-expanded:bg-secondary"
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
        <FeedContent className="flex flex-col items-center justify-center text-muted-foreground">
          <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-secondary">
            <LuLeaf />
          </div>
          <span>{t('No posts yet')}</span>
        </FeedContent>
      </FeedMain>
    </FeedItem>
  );
};

/**
 * Hook for optimistic like updates with server sync.
 * Returns displayPost with optimistic like data and a handleLikeClick function.
 * TODO: stopgap until we have server channels in place for updates
 */
const useOptimisticLike = (
  post: Post,
  onLikeClick: (postId: string) => Promise<unknown>,
) => {
  const { user } = useUser();
  const currentProfile = user?.currentProfile;

  const serverLike = {
    userHasLiked: post.userHasLiked,
    likeCount: post.likeCount,
    likeUsers: post.likeUsers,
  };

  const [localLike, setLocalLike] = useState(serverLike);

  // Sync pattern: setState during render is intentional to avoid extra render cycle.
  // This syncs local state when server data changes (after refetch).
  // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // The liker ids are in the key because a like and an unlike between refetches
  // leave the count untouched while changing who the tooltip should name.
  const serverLikeKey = `${serverLike.userHasLiked}-${serverLike.likeCount}-${serverLike.likeUsers.map((liker) => liker.id).join()}`;
  const [lastServerKey, setLastServerKey] = useState(serverLikeKey);
  if (serverLikeKey !== lastServerKey) {
    setLastServerKey(serverLikeKey);
    setLocalLike(serverLike);
  }

  const handleLikeClick = useCallback(
    (postId: string) => {
      const before = localLike;
      const optimistic = applyLikeToggle({ current: before, currentProfile });

      setLocalLike(optimistic);

      // A rejected like (rate limit, lost access) refetches to the values we
      // started from, so the sync key above is unchanged and can't undo the
      // optimistic flip. Put it back here instead, or the button stays lit.
      // Only when our own guess is still what's on screen though — a newer
      // click or a server sync has better information than this snapshot.
      void onLikeClick(postId).catch(() => {
        setLocalLike((current) => (current === optimistic ? before : current));
      });
    },
    [currentProfile, localLike, onLikeClick],
  );

  const displayPost = useMemo(
    () => ({ ...post, ...localLike }),
    [post, localLike],
  );

  return { displayPost, handleLikeClick };
};

export const PostItem = ({
  post,
  organization,
  user,
  withLinks,
  onLikeClick,
  onCommentClick,
  contentFooter,
  className,
}: {
  post: Post;
  organization: Organization | null;
  user?: CommonUser;
  withLinks: boolean;
  onLikeClick: (postId: string) => Promise<unknown>;
  onCommentClick?: (post: Post, organization: Organization | null) => void;
  /** Rendered under the post body, above the like/comment row. */
  contentFooter?: ReactNode;
  className?: string;
}) => {
  const decisionTranslation = useDecisionTranslation();
  const translatedContent = decisionTranslation?.posts[post.id]?.content;
  const displayContent = translatedContent ?? post?.content;
  const { urls } = useMemo(() => detectLinks(post?.content), [post?.content]);
  const { displayPost, handleLikeClick } = useOptimisticLike(post, onLikeClick);

  // For comments (posts without organization), show the post author
  // TODO: this is too complex. We need to refactor this
  const displayName =
    post?.profile?.name ?? organization?.profile.name ?? 'Unknown User';
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
                profile={profile}
                displayName={displayName}
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
          {contentFooter}
          <div className="-ms-2 flex items-center">
            <PostLikeButton post={displayPost} onLikeClick={handleLikeClick} />
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
  onLikeClick,
  commentCount,
  className,
}: {
  post: Post;
  organization: Organization | null;
  user?: CommonUser;
  withLinks: boolean;
  onLikeClick: (postId: string) => Promise<unknown>;
  commentCount: number;
  className?: string;
}) => {
  const t = useTranslations();
  const { urls } = useMemo(() => detectLinks(post?.content), [post?.content]);
  const { displayPost, handleLikeClick } = useOptimisticLike(post, onLikeClick);

  // For comments (posts without organization), show the post author
  // TODO: this is too complex. We need to refactor this
  const displayName =
    post?.profile?.name ?? organization?.profile.name ?? 'Unknown User';
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
                profile={profile}
                displayName={displayName}
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
          <div className="-ms-2 flex items-center">
            <PostLikeButton post={displayPost} onLikeClick={handleLikeClick} />
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
  const toggleLike = trpc.organization.toggleLike.useMutation({
    onSettled: () => {
      void utils.organization.listPosts.invalidate();
      void utils.organization.listAllPosts.invalidate();
      void utils.posts.getPosts.invalidate();
      void utils.posts.listProfilePosts.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t('Failed to update like'));
    },
  });

  // Returns the promise so the caller's optimistic state can roll itself back;
  // `onError` above still owns the toast.
  const handleLikeClick = (postId: string) =>
    toggleLike.mutateAsync({ postId });

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
    handleLikeClick,
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
