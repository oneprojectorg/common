'use client';

import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { AvatarSkeleton } from '@op/ui/Avatar';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem } from '../PostFeed';
import { FeedItem, FeedMain, FeedHeader, FeedContent } from '../Feed';

type PostFeedUser = NonNullable<ReturnType<typeof import('@/utils/UserProvider').useUser>['user']>;

export function CommentSkeleton() {
  return (
    <FeedItem className="sm:px-0">
      <AvatarSkeleton className="!size-8 max-h-8 max-w-8" />
      <FeedMain>
        <FeedHeader className="relative w-full justify-between">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </FeedHeader>
        <FeedContent>
          <SkeletonLine lines={2} />
        </FeedContent>
      </FeedMain>
    </FeedItem>
  );
}

export function Comments({
  postId,
  organization,
  user,
  onReactionClick,
}: {
  postId: string;
  organization: Organization | null;
  user: PostFeedUser | undefined;
  onReactionClick: (postId: string, emoji: string) => void;
}) {
  const t = useTranslations();

  const [comments] = trpc.posts.getPosts.useSuspenseQuery({
    parentPostId: postId,
    limit: 50,
    offset: 0,
    includeChildren: false,
  });

  if (comments.length === 0) {
    return (
      <div
        className="py-8 text-center text-neutral-gray4"
        role="status"
        aria-label="No comments"
      >
        {t('No comments yet. Be the first to comment!')}
      </div>
    );
  }

  return (
    <div role="feed" aria-label={`${comments.length} comments`}>
      <PostFeed>
        {comments.map((comment) => (
          <div key={comment.id}>
            <PostItem
              post={comment}
              organization={organization}
              user={user}
              withLinks={false}
              onReactionClick={onReactionClick}
              className="sm:px-0"
            />
            <hr className="mt-4 bg-neutral-gray1" />
          </div>
        ))}
      </PostFeed>
    </div>
  );
}
