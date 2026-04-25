'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Header2 } from '@op/ui/Header';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';

import { usePathname, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  DiscussionModalContainer,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';

const PANEL_TAB_QUERY_KEY = 'panelTab';
const VALID_PANEL_TABS = ['updates', 'meetings', 'resources'] as const;
const DEFAULT_PANEL_TAB: PanelTab = 'updates';

type PanelTab = (typeof VALID_PANEL_TABS)[number];

const isPanelTab = (value: string | null): value is PanelTab =>
  value !== null && (VALID_PANEL_TABS as readonly string[]).includes(value);

export const DecisionSidePanel = ({
  decisionProfileId,
}: {
  decisionProfileId: string;
}) => {
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getCurrentSelectedTab = useCallback((): PanelTab => {
    const currentTab = searchParams.get(PANEL_TAB_QUERY_KEY);
    if (isPanelTab(currentTab)) {
      return currentTab;
    }
    return DEFAULT_PANEL_TAB;
  }, [searchParams]);

  const [selectedKey, setSelectedKey] = useState<PanelTab>(
    getCurrentSelectedTab(),
  );

  const isUpdatingUrlRef = useRef(false);

  useEffect(() => {
    if (!isUpdatingUrlRef.current) {
      setSelectedKey(getCurrentSelectedTab());
    }
  }, [getCurrentSelectedTab]);

  const handleSelectionChange = useCallback(
    (key: Key) => {
      const keyString = String(key);
      if (!isPanelTab(keyString)) {
        return;
      }
      setSelectedKey(keyString);

      isUpdatingUrlRef.current = true;

      const newSearchParams = new URLSearchParams(searchParams.toString());
      if (keyString === DEFAULT_PANEL_TAB) {
        newSearchParams.delete(PANEL_TAB_QUERY_KEY);
      } else {
        newSearchParams.set(PANEL_TAB_QUERY_KEY, keyString);
      }

      const newUrl = newSearchParams.toString()
        ? `${pathname}?${newSearchParams.toString()}`
        : pathname;

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', newUrl);
      }

      isUpdatingUrlRef.current = false;
    },
    [pathname, searchParams],
  );

  return (
    <aside className="hidden w-80 shrink-0 border-l border-neutral-gray2 bg-white lg:flex lg:flex-col">
      <Tabs
        selectedKey={selectedKey}
        onSelectionChange={handleSelectionChange}
        className="gap-0"
      >
        <TabList className="px-4 pt-4">
          <Tab id="updates">{t('Updates')}</Tab>
          <Tab id="meetings">{t('Meetings')}</Tab>
          <Tab id="resources">{t('Resources')}</Tab>
        </TabList>
        <TabPanel id="updates" className="px-4 py-4">
          <Header2 className="font-serif text-title-sm leading-normal">
            {t('Updates')}
          </Header2>
          <ErrorBoundary>
            <Suspense fallback={<PostFeedSkeleton numPosts={2} />}>
              <UpdatesFeed decisionProfileId={decisionProfileId} />
            </Suspense>
          </ErrorBoundary>
        </TabPanel>
        <TabPanel id="meetings" className="px-4 py-4 text-neutral-gray4">
          {t('Coming soon')}
        </TabPanel>
        <TabPanel id="resources" className="px-4 py-4 text-neutral-gray4">
          {t('Coming soon')}
        </TabPanel>
      </Tabs>
    </aside>
  );
};

const UpdatesFeed = ({ decisionProfileId }: { decisionProfileId: string }) => {
  const t = useTranslations();
  const { user } = useUser();

  const [posts] = trpc.posts.getPosts.useSuspenseQuery({
    profileId: decisionProfileId,
    parentPostId: null,
    limit: 20,
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
