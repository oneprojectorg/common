'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { Sheet, SheetBody, SheetHeader } from '@op/ui/Sheet';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import { usePathname, useRouter, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  DiscussionModalContainer,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

const PANEL_QUERY_KEY = 'panel';
const PANEL_OPEN_VALUE = 'updates';

export const DecisionSidePanel = ({
  decisionProfileId,
  access,
}: {
  decisionProfileId: string;
  access?: DecisionAccess | null;
}) => {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const decisionUpdatesEnabled = useFeatureFlag('decision_updates');

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = access?.admin === true || access?.read === true;

  const isOpen =
    decisionUpdatesEnabled &&
    searchParams.get(PANEL_QUERY_KEY) === PANEL_OPEN_VALUE;

  const handleClose = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(PANEL_QUERY_KEY);
    const newUrl = next.toString()
      ? `${pathname}?${next.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  if (!decisionUpdatesEnabled) {
    return null;
  }

  return (
    <Sheet
      side="right"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
      className="max-w-sm"
    >
      <SheetHeader onClose={handleClose}>{t('Updates')}</SheetHeader>
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
          <div className="py-6 text-center text-neutral-gray4">
            {t("You don't have access to updates for this decision.")}
          </div>
        )}
      </SheetBody>
    </Sheet>
  );
};

const UpdatesFeed = ({ decisionProfileId }: { decisionProfileId: string }) => {
  const t = useTranslations();
  const { user } = useUser();

  const [posts] = trpc.posts.getPosts.useSuspenseQuery({
    profileId: decisionProfileId,
    parentPostId: null,
    limit: 50,
    offset: 0,
    includeChildren: false,
  });

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions();

  if (posts.length === 0) {
    return (
      <div className="py-6 text-center text-neutral-gray4">
        {t('No updates yet')}
      </div>
    );
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
      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={handleModalClose}
      />
    </>
  );
};
