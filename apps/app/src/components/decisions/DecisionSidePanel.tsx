'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { Sheet, SheetBody, SheetHeader } from '@op/ui/Sheet';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import type { Key } from 'react-aria-components';

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

const PANEL_TAB_QUERY_KEY = 'panelTab';
const VALID_PANEL_TABS = ['updates', 'meetings', 'resources'] as const;
const DEFAULT_PANEL_TAB: PanelTab = 'updates';

type PanelTab = (typeof VALID_PANEL_TABS)[number];

const isPanelTab = (value: string | null): value is PanelTab =>
  value !== null && (VALID_PANEL_TABS as readonly string[]).includes(value);

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

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = access?.admin === true || access?.read === true;

  const queryParam = searchParams.get(PANEL_TAB_QUERY_KEY);
  const isOpen = isPanelTab(queryParam);
  const selectedKey: PanelTab = isPanelTab(queryParam)
    ? queryParam
    : DEFAULT_PANEL_TAB;

  const writeUrl = useCallback(
    (next: URLSearchParams) => {
      const newUrl = next.toString()
        ? `${pathname}?${next.toString()}`
        : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router],
  );

  const handleSelectionChange = useCallback(
    (key: Key) => {
      const keyString = String(key);
      if (!isPanelTab(keyString)) {
        return;
      }
      const next = new URLSearchParams(searchParams.toString());
      next.set(PANEL_TAB_QUERY_KEY, keyString);
      writeUrl(next);
    },
    [searchParams, writeUrl],
  );

  const handleClose = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(PANEL_TAB_QUERY_KEY);
    writeUrl(next);
  }, [searchParams, writeUrl]);

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
      <SheetHeader onClose={handleClose} />
      <SheetBody className="flex flex-col">
        <Tabs
          selectedKey={selectedKey}
          onSelectionChange={handleSelectionChange}
          className="gap-0"
        >
          <TabList className="px-4 pt-2">
            <Tab id="updates">{t('Updates')}</Tab>
            <Tab id="meetings">{t('Meetings')}</Tab>
            <Tab id="resources">{t('Resources')}</Tab>
          </TabList>
          <TabPanel id="updates" className="px-4 py-4">
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
          </TabPanel>
          <TabPanel id="meetings" className="px-4 py-4 text-neutral-gray4">
            {t('Coming soon')}
          </TabPanel>
          <TabPanel id="resources" className="px-4 py-4 text-neutral-gray4">
            {t('Coming soon')}
          </TabPanel>
        </Tabs>
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
