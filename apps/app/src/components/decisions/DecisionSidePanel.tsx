'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Card } from '@op/sense/Card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '@op/sense/Empty';
import { Header2 } from '@op/sense/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { MegaphoneIcon } from '@op/sense/icons';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';
import { Fragment, Suspense, useCallback, useEffect, useMemo } from 'react';
import { LuX } from 'react-icons/lu';

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
import { ResourcesTabContent } from '@/components/Resources/ResourcesTabContent';

import { PANEL_TABS, type PanelTab, panelStateParser } from './panelState';

const UPDATES_PAGE_SIZE = 20;

const isPanelTab = (key: string): key is PanelTab =>
  (PANEL_TABS as readonly string[]).includes(key);

export const DecisionSidePanel = ({
  decisionProfileId,
  access,
}: {
  decisionProfileId: string;
  access?: DecisionAccess | null;
}) => {
  const t = useTranslations();
  const [panel, setPanel] = useQueryState('panel', panelStateParser);

  const isOpen = panel !== null;
  const close = useCallback(() => setPanel(null), [setPanel]);

  // Non-modal side drawer: on desktop the decision page behind stays
  // interactive (this is a side panel, not a Dialog/Sheet), so wire Escape
  // ourselves rather than relying on an overlay primitive.
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

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = canPostUpdate || access?.read === true;
  const activeTab: PanelTab = panel ?? 'updates';

  if (!canReadUpdates || !isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile-only backdrop. On desktop this is a non-modal side panel — the
          page behind stays interactive — so there is no scrim there. */}
      <div
        className="fixed inset-0 z-40 bg-black/20 sm:hidden"
        aria-hidden
        onClick={close}
      />
      <aside
        role="dialog"
        aria-label={t('Decision updates panel')}
        className={cn(
          'fixed z-40 flex flex-col bg-white text-neutral-charcoal shadow-xl',
          // Mobile: full-screen.
          'inset-0 w-full max-w-full',
          // Desktop: drawer floating below the header, always anchored to the
          // visual right (physical props so it does not flip in RTL), border
          // facing the content.
          'sm:inset-y-auto sm:top-12 sm:right-0 sm:bottom-0 sm:left-auto sm:w-[22.5rem] sm:border-l sm:border-neutral-gray1 md:top-14',
        )}
      >
        <PanelContents
          isOpen={isOpen}
          decisionProfileId={decisionProfileId}
          canPostUpdate={canPostUpdate}
          canReadUpdates={canReadUpdates}
          activeTab={activeTab}
          onSelectTab={setPanel}
          onClose={close}
        />
      </aside>
    </>
  );
};

const PanelContents = ({
  isOpen,
  decisionProfileId,
  canPostUpdate,
  canReadUpdates,
  activeTab,
  onSelectTab,
  onClose,
}: {
  isOpen: boolean;
  decisionProfileId: string;
  canPostUpdate: boolean;
  canReadUpdates: boolean;
  activeTab: PanelTab;
  onSelectTab: (tab: PanelTab) => void;
  onClose: () => void;
}) => {
  const t = useTranslations();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isPanelTab(value)) {
          onSelectTab(value);
        }
      }}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-gray1 pe-4 sm:pe-0 sm:pt-4">
        <TabsList
          variant="line"
          aria-label={t('Decision side panel tabs')}
          className="grow border-b-0 px-4 sm:px-6"
        >
          <TabsTrigger value="updates" className="h-auto px-0">
            {t('Updates')}
          </TabsTrigger>
          <TabsTrigger value="resources" className="h-auto px-0">
            {t('Resources')}
          </TabsTrigger>
        </TabsList>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={t('Close')}
          className="sm:hidden"
        >
          <LuX className="size-5" />
        </Button>
      </div>

      <TabsContent
        value="updates"
        className="flex min-h-0 flex-col overflow-y-auto p-0 sm:p-0"
      >
        {isOpen ? (
          <UpdatesTabContent
            decisionProfileId={decisionProfileId}
            canPostUpdate={canPostUpdate}
            canReadUpdates={canReadUpdates}
          />
        ) : null}
      </TabsContent>
      <TabsContent
        value="resources"
        className="flex min-h-0 flex-col overflow-y-auto p-0 sm:p-0"
      >
        {isOpen ? (
          <ResourcesTabContent
            profileId={decisionProfileId}
            canManage={canPostUpdate}
            canRead={canReadUpdates}
          />
        ) : null}
      </TabsContent>
    </Tabs>
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
          <Card className="rounded-lg p-4 pt-5 shadow-none">
            <PostUpdate
              profileId={decisionProfileId}
              placeholder={t('Share an update with participants…')}
              label={t('Post')}
              onSuccess={handlePostSuccess}
            />
          </Card>
        ) : null}
        {canReadUpdates ? (
          <ErrorBoundary>
            <Suspense fallback={<PostFeedSkeleton numPosts={2} />}>
              <UpdatesFeed decisionProfileId={decisionProfileId} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MegaphoneIcon />
              </EmptyMedia>
              <EmptyDescription>
                {t("You don't have access to updates for this decision.")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MegaphoneIcon />
          </EmptyMedia>
          <EmptyDescription>{t('No updates yet')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
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
