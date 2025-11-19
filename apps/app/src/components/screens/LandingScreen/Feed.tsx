'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { useCursorPagination } from '@op/hooks';
import { Pagination } from '@op/ui/Pagination';
import { Fragment, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  DiscussionModalContainer,
  EmptyPostsState,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';

/** Main Feed component wrapper */
export const Feed = () => {
  return (
    <Suspense fallback={<PostFeedSkeleton numPosts={10} />}>
      <FeedContent />
    </Suspense>
  );
};

/** Feed content component with live data */
const FeedContent = () => {
  const t = useTranslations();
  const { user } = useUser() ?? {};
  const {
    cursor,
    currentPage,
    limit,
    handleNext,
    handlePrevious,
    canGoPrevious,
  } = useCursorPagination(10);

  const [postsData] = trpc.organization.listAllPosts.useSuspenseQuery({
    limit,
    cursor,
  });

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions({ user });

  if (!postsData || !user) {
    return <PostFeedSkeleton numPosts={4} />;
  }

  const { items, next, hasMore, total } = postsData;

  const onNext = () => {
    if (hasMore && next) {
      handleNext(next);
    }
  };

  return (
    <PostFeed>
      {items.length > 0 ? (
        items.map((postToOrg) => (
          <Fragment key={postToOrg.postId}>
            <PostItem
              post={postToOrg.post}
              organization={postToOrg.organization ?? null}
              user={user}
              withLinks={true}
              onReactionClick={handleReactionClick}
              onCommentClick={handleCommentClick}
            />
            <hr className="bg-neutral-gray1" />
          </Fragment>
        ))
      ) : (
        <EmptyPostsState />
      )}

      {items.length > 0 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            range={{
              totalItems: total,
              itemsPerPage: limit,
              page: currentPage,
              label: t('posts'),
            }}
            next={hasMore ? onNext : undefined}
            previous={canGoPrevious ? handlePrevious : undefined}
          />
        </div>
      )}

      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={handleModalClose}
      />
    </PostFeed>
  );
};
