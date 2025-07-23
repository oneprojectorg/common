'use client';

import { OrganizationUser } from '@/utils/UserProvider';
import type { PostToOrganization } from '@op/api/encoders';
import { AvatarSkeleton } from '@op/ui/Avatar';
import { Header3 } from '@op/ui/Header';
import { Skeleton, SkeletonLine } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { Fragment, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { CommentModal } from '../CommentModal';
import { FeedContent, FeedHeader, FeedItem, FeedMain } from '../Feed';
import { PostItem } from '../PostItem';

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
  const [openCommentModals, setOpenCommentModals] = useState<
    Record<string, boolean>
  >({});

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
          return (
            <Fragment key={i}>
              <PostItem
                organization={organization}
                post={post}
                user={user}
                withLinks={withLinks}
                withActions={true}
                onCommentClick={() => post?.id && openCommentModal(post.id)}
                commentCount={post?.commentCount || 0}
                slug={slug}
                limit={limit}
                className="sm:px-4"
              />
              <hr className="bg-neutral-gray1" />
              {post?.id && openCommentModals[post.id] && (
                <CommentModal
                  isOpen={!!openCommentModals[post.id]}
                  onClose={() => closeCommentModal(post.id!)}
                  postData={{ organization, post }}
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
