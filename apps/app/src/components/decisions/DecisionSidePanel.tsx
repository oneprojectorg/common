'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import { IconButton } from '@op/ui/IconButton';
import { Sidebar, SidebarProvider, useSidebar } from '@op/ui/Sidebar';
import { Surface } from '@op/ui/Surface';
import { useQueryState } from 'nuqs';
import { Fragment, Suspense, useCallback, useEffect, useMemo } from 'react';
import { LuMegaphone, LuX } from 'react-icons/lu';

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

import { panelStateParser } from './panelState';

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

  const isOpen = panel !== null;
  const close = useCallback(() => setPanel(null), [setPanel]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        close();
      }
    },
    [close],
  );

  // Sidebar's mobile branch (React Aria Modal) handles Escape + scroll lock
  // for small screens; the desktop overlay branch is just a fixed div, so
  // wire Escape ourselves for that case.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!decisionUpdatesEnabled) {
    return null;
  }

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = canPostUpdate || access?.read === true;

  return (
    <SidebarProvider isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Sidebar
        side="right"
        variant="overlay"
        label={t('Decision updates panel')}
        className="w-full max-w-full border-t border-l border-neutral-gray1 text-neutral-charcoal shadow-xl sm:top-14 sm:w-[22.5rem]"
      >
        <PanelContents
          isOpen={isOpen}
          decisionProfileId={decisionProfileId}
          canPostUpdate={canPostUpdate}
          canReadUpdates={canReadUpdates}
        />
      </Sidebar>
    </SidebarProvider>
  );
};

const PanelContents = ({
  isOpen,
  decisionProfileId,
  canPostUpdate,
  canReadUpdates,
}: {
  isOpen: boolean;
  decisionProfileId: string;
  canPostUpdate: boolean;
  canReadUpdates: boolean;
}) => {
  const t = useTranslations();
  const { setOpen } = useSidebar();

  return (
    <>
      <div className="flex shrink-0 items-center justify-end border-b border-neutral-gray1 px-4 py-2 sm:hidden">
        <IconButton
          variant="ghost"
          size="small"
          onPress={() => setOpen(false)}
          aria-label={t('Close')}
        >
          <LuX className="size-5" />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {isOpen ? (
          <UpdatesTabContent
            decisionProfileId={decisionProfileId}
            canPostUpdate={canPostUpdate}
            canReadUpdates={canReadUpdates}
          />
        ) : null}
      </div>
    </>
  );
};

const UpdatesTabContent = ({
  decisionProfileId,
  canPostUpdate,
  canReadUpdates,
}: {
  decisionProfileId: string;
  canPostUpdate: boolean;
  canReadUpdates: boolean;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const handlePostSuccess = useCallback(() => {
    void utils.posts.listProfilePosts.invalidate({
      profileId: decisionProfileId,
    });
  }, [utils, decisionProfileId]);

  return (
    <div className="flex flex-col px-4 pt-4 pb-8 sm:px-6">
      <Header2 className="font-serif text-title-base">{t('Updates')}</Header2>
      <div className="mt-4 flex flex-col gap-6">
        {canPostUpdate ? (
          <Surface className="rounded-lg p-4 pt-5">
            <PostUpdate
              profileId={decisionProfileId}
              placeholder={t('Share an update with participants…')}
              label={t('Post')}
              onSuccess={handlePostSuccess}
            />
          </Surface>
        ) : null}
        {canReadUpdates ? (
          <ErrorBoundary>
            <Suspense fallback={<PostFeedSkeleton numPosts={2} />}>
              <UpdatesFeed decisionProfileId={decisionProfileId} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <EmptyState icon={<LuMegaphone />}>
            {t("You don't have access to updates for this decision.")}
          </EmptyState>
        )}
      </div>
    </div>
  );
};

const UpdatesFeed = ({ decisionProfileId }: { decisionProfileId: string }) => {
  const t = useTranslations();
  const { user } = useUser();

  const [paginatedData, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.posts.listProfilePosts.useSuspenseInfiniteQuery(
      { profileId: decisionProfileId, limit: UPDATES_PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.next ?? undefined,
        staleTime: 30 * 1000,
      },
    );

  const posts = useMemo(
    () => paginatedData.pages.flatMap((page) => page.items),
    [paginatedData.pages],
  );

  const { ref, shouldShowTrigger } = useInfiniteScroll<HTMLDivElement>(
    fetchNextPage,
    {
      hasNextPage,
      isFetchingNextPage,
      threshold: 0.1,
      rootMargin: '50px',
    },
  );

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions();

  if (posts.length === 0) {
    return (
      <EmptyState icon={<LuMegaphone />}>{t('No updates yet')}</EmptyState>
    );
  }

  return (
    <>
      <PostFeed className="pb-0">
        {posts.map((post) => (
          <Fragment key={post.id}>
            <PostItem
              post={post}
              organization={null}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
              onCommentClick={handleCommentClick}
              className="sm:px-0"
            />
            <hr />
          </Fragment>
        ))}
      </PostFeed>
      {shouldShowTrigger && (
        <div ref={ref} className="flex justify-center py-4">
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
