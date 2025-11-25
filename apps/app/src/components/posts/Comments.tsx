'use client';

import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useTranslations } from '@/lib/i18n';

import { FeedContent, FeedHeader, FeedItem, FeedMain } from '../Feed';
import { PostFeed, PostItem } from '../PostFeed';

type PostFeedUser = NonNullable<
  ReturnType<typeof import('@/utils/UserProvider').useUser>['user']
>;

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

  const { data: comments } = useSuspenseQuery({
    queryKey: [
      ['posts', 'getPosts'],
      { parentPostId: postId, limit: 50, offset: 0, includeChildren: false },
    ],
    queryFn: () =>
      trpc.posts.getPosts.query({
        parentPostId: postId,
        limit: 50,
        offset: 0,
        includeChildren: false,
      }),
  });

  if (comments.length === 0) {
    return (
      <div
        className="py-8 text-center text-neutral-gray4"
        role="status"
        aria-label={t('No comments yet. Be the first to comment!')}
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
