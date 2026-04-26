'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { Sheet, SheetBody, SheetHeader } from '@op/ui/Sheet';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense, useCallback } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  DiscussionModalContainer,
  EmptyPostsState,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

export const panelStateParser = parseAsStringLiteral(['updates'] as const);

const UPDATES_PAGE_SIZE = 20;

export const DecisionSidePanel = ({
  decisionProfileId,
  access,
}: {
  decisionProfileId: string;
  access?: DecisionAccess | null;
}) => {
  const t = useTranslations();
  const [panel, setPanel] = useQueryState('panel', panelStateParser);
  const decisionUpdatesEnabled = useFeatureFlag('decision_updates');

  if (!decisionUpdatesEnabled) {
    return null;
  }

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = access?.admin === true || access?.read === true;

  return (
    <Sheet
      side="right"
      isOpen={panel === 'updates'}
      onOpenChange={(open) => {
        if (!open) {
          setPanel(null);
        }
      }}
      className="max-w-sm"
    >
      <SheetHeader onClose={() => setPanel(null)}>{t('Updates')}</SheetHeader>
      <SheetBody className="flex flex-col px-4 py-4">
        {canPostUpdate ? (
          <PostUpdate
            profileId={decisionProfileId}
            placeholder={t('Share an update with participants…')}
            label={t('Post')}
          />
        ) : null}
        {canReadUpdates ? (
          <ErrorBoundary>
            <Suspense fallback={<PostFeedSkeleton numPosts={2} />}>
              <UpdatesFeed decisionProfileId={decisionProfileId} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <EmptyPostsState />
        )}
      </SheetBody>
    </Sheet>
  );
};

const UpdatesFeed = ({ decisionProfileId }: { decisionProfileId: string }) => {
  const { user } = useUser();

  const [paginatedData, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.posts.listProfilePosts.useSuspenseInfiniteQuery(
      { profileId: decisionProfileId, limit: UPDATES_PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.next ?? undefined,
        staleTime: 30 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    );

  const posts = paginatedData.pages.flatMap((page) => page.items);

  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref, shouldShowTrigger } = useInfiniteScroll(stableFetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '50px',
  });

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions();

  if (posts.length === 0) {
    return <EmptyPostsState />;
  }

  return (
    <>
      <PostFeed className="pt-4">
        {posts.map((post) => (
          <PostItem
            key={post.id}
            post={post}
            organization={null}
            user={user}
            withLinks={false}
            onReactionClick={handleReactionClick}
            onCommentClick={handleCommentClick}
            className="sm:px-0"
          />
        ))}
      </PostFeed>
      {shouldShowTrigger && (
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="flex justify-center py-4"
        >
          {isFetchingNextPage && <PostFeedSkeleton numPosts={1} />}
        </div>
      )}
      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={handleModalClose}
      />
    </>
  );
};
