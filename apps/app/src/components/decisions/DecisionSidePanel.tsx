'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { Sheet, SheetBody, SheetHeader } from '@op/ui/Sheet';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  DiscussionModalContainer,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

export const panelStateParser = parseAsStringLiteral(['updates'] as const);

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
