'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { AddResourcePanel } from './AddResourcePanel';
import { ResourceEmptyState } from './ResourceEmptyState';
import { ResourcesList } from './ResourcesList';

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

  if (canManage && adding) {
    return (
      <AddResourcePanel
        profileId={profileId}
        onClose={() => setAdding(false)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-4 sm:px-6">
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
                <ResourcesFeed profileId={profileId} canManage={canManage} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <ResourceEmptyState variant="no-access" />
          )}
        </div>
      </div>
      {canManage ? (
        <div className="sticky bottom-0 mt-auto shrink-0 border-t border-neutral-gray1 bg-white px-4 py-4 sm:px-6">
          <Button
            color="secondary"
            size="small"
            onPress={() => setAdding(true)}
            className="w-full justify-center text-primary-teal"
          >
            <LuPlus className="size-4" />
            {t('Add resource')}
          </Button>
        </div>
      ) : null}
    </>
  );
};

const ResourcesFeed = ({
  profileId,
  canManage,
}: {
  profileId: string;
  canManage: boolean;
}) => {
  const [data] = trpc.resources.list.useSuspenseQuery(
    { profileId },
    { staleTime: 30 * 1000 },
  );

  if (data.items.length === 0) {
    return (
      <ResourceEmptyState
        variant={canManage ? 'admin-empty' : 'member-empty'}
      />
    );
  }

  return (
    <ResourcesList profileId={profileId} data={data} canManage={canManage} />
  );
};
