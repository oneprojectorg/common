'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Sheet, SheetContent, SheetTitle } from '@op/sense/Sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { MegaphoneIcon } from '@op/sense/icons';
import { useQueryState } from 'nuqs';
import { Fragment, Suspense, useCallback, useMemo } from 'react';
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

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = canPostUpdate || access?.read === true;
  const activeTab: PanelTab = panel ?? 'updates';

  if (!canReadUpdates) {
    return null;
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open, details) => {
        // Modal side panel (matches the Figma scrim). Dismisses on outside
        // press and the close button, but deliberately NOT on Escape — the
        // open state lives in the URL, so we just ignore the escape-key reason.
        if (open || details.reason === 'escape-key') {
          return;
        }
        close();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        // Desktop: sit below the fixed decision header (h-12/h-14) instead of
        // running full-height under it. Mobile stays full-screen.
        className="gap-0 p-0 sm:max-w-[22.5rem]"
      >
        <SheetTitle className="sr-only">
          {t('Decision updates panel')}
        </SheetTitle>
        <PanelContents
          isOpen={isOpen}
          decisionProfileId={decisionProfileId}
          canPostUpdate={canPostUpdate}
          canReadUpdates={canReadUpdates}
          activeTab={activeTab}
          onSelectTab={setPanel}
          onClose={close}
        />
      </SheetContent>
    </Sheet>
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
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pe-4 sm:pt-4">
        <TabsList
          variant="line"
          aria-label={t('Decision side panel tabs')}
          className="grow justify-start border-b-0 px-4 sm:px-6"
        >
          <TabsTrigger value="updates" className="h-auto flex-none">
            {t('Updates')}
          </TabsTrigger>
          <TabsTrigger value="resources" className="h-auto flex-none">
            {t('Resources')}
          </TabsTrigger>
        </TabsList>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t('Close')}
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
      <div className="mt-4 flex flex-col gap-6">
        {canPostUpdate ? (
          <PostUpdate
            profileId={decisionProfileId}
            placeholder={t('Share an update with participants…')}
            label={t('Post')}
            onSuccess={handlePostSuccess}
          />
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
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MegaphoneIcon />
          </EmptyMedia>
          <EmptyTitle>{t('No updates yet')}</EmptyTitle>
          <EmptyDescription className="max-w-72">
            {t("The organizers haven't posted any updates yet")}
          </EmptyDescription>
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
