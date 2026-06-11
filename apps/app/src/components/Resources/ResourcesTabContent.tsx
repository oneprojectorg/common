'use client';

import { trpc } from '@op/api/client';
import { Accordion } from '@op/ui/Accordion';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { AddResourcePanel } from './AddResourcePanel';
import { CollectionSection } from './CollectionSection';
import { ResourceDropZone } from './ResourceDropZone';
import { ResourceEmptyState } from './ResourceEmptyState';

export const ResourcesTabContent = ({
  profileId,
  canManage,
  canRead,
}: {
  profileId: string;
  canManage: boolean;
  canRead: boolean;
}) => {
  const t = useTranslations();
  const [adding, setAdding] = useState(false);
  // Shares the cache with ResourcesFeed's suspense query — used only to hide
  // the footer when the list is empty (the empty state has its own CTA).
  const { data: collections } = trpc.resources.collections.list.useQuery(
    { profileId },
    { enabled: canRead, staleTime: 30 * 1000 },
  );
  const isEmpty = collections !== undefined && collections.items.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
        <Header2 className="font-serif text-title-base">
          {t('Resources')}
        </Header2>
        <div className="mt-4">
          {canRead ? (
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-44 w-full rounded-lg" />
                    <Skeleton className="h-44 w-full rounded-lg" />
                  </div>
                }
              >
                <ResourcesFeed
                  profileId={profileId}
                  canManage={canManage}
                  onAddResource={() => setAdding(true)}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <ResourceEmptyState variant="no-access" />
          )}
        </div>
      </div>
      {canManage && !adding && !isEmpty ? (
        <div className="shrink-0 border-t border-neutral-gray1 bg-white px-4 py-6 sm:px-6">
          <Button
            color="secondary"
            size="small"
            onPress={() => setAdding(true)}
            className="w-full justify-center"
          >
            <LuPlus className="size-4" />
            {t('Add resource')}
          </Button>
        </div>
      ) : null}
      {canManage && adding ? (
        <div className="absolute inset-x-0 top-4 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-lg border-t border-neutral-gray1 bg-white shadow-lg">
          <AddResourcePanel
            profileId={profileId}
            onClose={() => setAdding(false)}
          />
        </div>
      ) : null}
    </div>
  );
};

const ResourcesFeed = ({
  profileId,
  canManage,
  onAddResource,
}: {
  profileId: string;
  canManage: boolean;
  onAddResource: () => void;
}) => {
  const [collections] = trpc.resources.collections.list.useSuspenseQuery(
    { profileId },
    { staleTime: 30 * 1000 },
  );

  if (collections.items.length === 0) {
    // Managers can drop a file/link straight onto the empty state — the drop
    // lazily creates the Default collection. Readers just see the empty state.
    if (canManage) {
      return (
        <ResourceDropZone profileId={profileId} collectionId={null} items={[]}>
          <ResourceEmptyState
            variant="admin-empty"
            onAddResource={onAddResource}
          />
        </ResourceDropZone>
      );
    }
    return <ResourceEmptyState variant="member-empty" />;
  }

  return (
    <Accordion
      allowsMultipleExpanded
      defaultExpandedKeys={collections.items.map((c) => c.id)}
      className="gap-4"
    >
      {collections.items.map((collection) => (
        <CollectionSection
          key={collection.id}
          profileId={profileId}
          collectionId={collection.id}
          name={collection.name}
          canManage={canManage}
        />
      ))}
    </Accordion>
  );
};
