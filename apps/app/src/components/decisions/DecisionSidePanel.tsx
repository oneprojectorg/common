'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { useInfiniteScroll, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import { IconButton } from '@op/ui/IconButton';
import { Surface } from '@op/ui/Surface';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { cn } from '@op/ui/utils';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Fragment, Suspense, useCallback, useEffect } from 'react';
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

export const panelStateParser = parseAsStringLiteral([
  'updates',
  'meetings',
  'resources',
] as const);

const UPDATES_PAGE_SIZE = 20;
const DESKTOP_PANEL_WIDTH = 360;
const HEADER_HEIGHT = 57;

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
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);

  const isOpen = panel !== null;
  const close = useCallback(() => setPanel(null), [setPanel]);

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

  useEffect(() => {
    if (!isOpen || !isMobile) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMobile]);

  if (!decisionUpdatesEnabled) {
    return null;
  }

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = canPostUpdate || access?.read === true;
  const activeTab = panel ?? 'updates';

  return (
    <>
      {isOpen && isMobile ? (
        <div
          aria-hidden="true"
          onClick={close}
          className="fixed inset-0 z-30 bg-neutral-black/30 sm:hidden"
        />
      ) : null}
      <aside
        role="dialog"
        aria-label={t('Decision updates panel')}
        aria-hidden={!isOpen}
        style={
          isMobile
            ? { top: 0, width: '100%' }
            : { top: HEADER_HEIGHT, width: DESKTOP_PANEL_WIDTH }
        }
        className={cn(
          'fixed right-0 bottom-0 z-40 flex max-w-full flex-col border-l border-neutral-gray1 bg-white shadow-xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
      >
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) =>
            setPanel(key as 'updates' | 'meetings' | 'resources')
          }
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-gray1 pr-2 sm:pr-0">
            <TabList
              aria-label={t('Decision side panel tabs')}
              className="flex grow gap-4 overflow-x-auto border-b-0 px-6"
            >
              <Tab id="updates" className="px-0 py-4">
                {t('Updates')}
              </Tab>
              <Tab id="meetings" className="px-0 py-4">
                {t('Meetings')}
              </Tab>
              <Tab id="resources" className="px-0 py-4">
                {t('Resources')}
              </Tab>
            </TabList>
            {isMobile ? (
              <IconButton
                variant="ghost"
                size="small"
                onPress={close}
                aria-label={t('Close')}
              >
                <LuX className="size-4" />
              </IconButton>
            ) : null}
          </div>

          <TabPanel
            id="updates"
            className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto p-0 sm:p-0"
          >
            <UpdatesTabContent
              decisionProfileId={decisionProfileId}
              canPostUpdate={canPostUpdate}
              canReadUpdates={canReadUpdates}
            />
          </TabPanel>
          <TabPanel
            id="meetings"
            className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto p-0 sm:p-0"
          >
            <ComingSoonContent title={t('Meetings')} />
          </TabPanel>
          <TabPanel
            id="resources"
            className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto p-0 sm:p-0"
          >
            <ComingSoonContent title={t('Resources')} />
          </TabPanel>
        </Tabs>
      </aside>
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
    <div className="flex flex-col px-6 pt-4 pb-8">
      <Header2 className="font-serif text-title-base">{t('Updates')}</Header2>
      <div className="mt-4 flex flex-col gap-6">
        {canPostUpdate ? (
          <Surface className="border p-4">
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

const ComingSoonContent = ({ title }: { title: string }) => {
  const t = useTranslations();
  return (
    <div className="flex flex-col px-6 pt-6 pb-8">
      <Header2 className="font-serif text-title-base">{title}</Header2>
      <p className="mt-4 text-sm text-neutral-gray4">{t('Coming soon')}</p>
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
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    );

  const posts = paginatedData.pages.flatMap((page) => page.items);

  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref, shouldShowTrigger } = useInfiniteScroll<HTMLDivElement>(
    stableFetchNextPage,
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
