'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';
import { LuPanelRightOpen } from 'react-icons/lu';

import { usePathname, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  DiscussionModalContainer,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

import { ProposalEditorAside } from './ProposalEditorAside';

const PANEL_TAB_QUERY_KEY = 'panelTab';
const PANEL_OPEN_QUERY_KEY = 'panel';
const PANEL_CLOSED_VALUE = 'closed';
const VALID_PANEL_TABS = ['updates', 'meetings', 'resources'] as const;
const DEFAULT_PANEL_TAB: PanelTab = 'updates';

type PanelTab = (typeof VALID_PANEL_TABS)[number];

const noopReaction: (postId: string, emoji: string) => void = () => {};

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
  const searchParams = useSearchParams();

  const canPostUpdate = access?.admin === true;
  const canReadUpdates = access?.admin === true || access?.read === true;
  const canInteract =
    access?.admin === true || access?.submitProposals === true;

  const isOpenFromUrl = useCallback(
    () => searchParams.get(PANEL_OPEN_QUERY_KEY) !== PANEL_CLOSED_VALUE,
    [searchParams],
  );

  const getCurrentSelectedTab = useCallback((): PanelTab => {
    const currentTab = searchParams.get(PANEL_TAB_QUERY_KEY);
    if (isPanelTab(currentTab)) {
      return currentTab;
    }
    return DEFAULT_PANEL_TAB;
  }, [searchParams]);

  const [isOpen, setIsOpen] = useState(isOpenFromUrl);
  const [selectedKey, setSelectedKey] = useState<PanelTab>(
    getCurrentSelectedTab(),
  );

  const isUpdatingUrlRef = useRef(false);

  useEffect(() => {
    if (isUpdatingUrlRef.current) {
      return;
    }
    setIsOpen(isOpenFromUrl());
    setSelectedKey(getCurrentSelectedTab());
  }, [getCurrentSelectedTab, isOpenFromUrl]);

  const writeUrl = useCallback(
    (next: URLSearchParams) => {
      isUpdatingUrlRef.current = true;
      const newUrl = next.toString()
        ? `${pathname}?${next.toString()}`
        : pathname;
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', newUrl);
      }
      isUpdatingUrlRef.current = false;
    },
    [pathname],
  );

  const handleSelectionChange = useCallback(
    (key: Key) => {
      const keyString = String(key);
      if (!isPanelTab(keyString)) {
        return;
      }
      setSelectedKey(keyString);
      const next = new URLSearchParams(searchParams.toString());
      if (keyString === DEFAULT_PANEL_TAB) {
        next.delete(PANEL_TAB_QUERY_KEY);
      } else {
        next.set(PANEL_TAB_QUERY_KEY, keyString);
      }
      writeUrl(next);
    },
    [searchParams, writeUrl],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    const next = new URLSearchParams(searchParams.toString());
    next.set(PANEL_OPEN_QUERY_KEY, PANEL_CLOSED_VALUE);
    writeUrl(next);
  }, [searchParams, writeUrl]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete(PANEL_OPEN_QUERY_KEY);
    writeUrl(next);
  }, [searchParams, writeUrl]);

  if (!isOpen) {
    return (
      <div className="hidden shrink-0 border-l border-neutral-gray1 bg-white p-2 sm:flex sm:flex-col">
        <Button
          color="secondary"
          variant="icon"
          size="small"
          onPress={handleOpen}
          aria-label={t('Open updates panel')}
          className="size-8 min-w-8 rounded-sm p-0"
        >
          <LuPanelRightOpen className="size-4" />
        </Button>
      </div>
    );
  }

  const tabTitleByKey: Record<PanelTab, string> = {
    updates: t('Updates'),
    meetings: t('Meetings'),
    resources: t('Resources'),
  };

  return (
    <ProposalEditorAside
      title={tabTitleByKey[selectedKey]}
      onClose={handleClose}
      bodyClassName="flex flex-col"
    >
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
                <UpdatesFeed
                  decisionProfileId={decisionProfileId}
                  canInteract={canInteract}
                />
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
    </ProposalEditorAside>
  );
};

const UpdatesFeed = ({
  decisionProfileId,
  canInteract,
}: {
  decisionProfileId: string;
  canInteract: boolean;
}) => {
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
            onReactionClick={canInteract ? handleReactionClick : noopReaction}
            onCommentClick={canInteract ? handleCommentClick : undefined}
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
