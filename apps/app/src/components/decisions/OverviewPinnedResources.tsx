'use client';

import { trpc } from '@op/api/client';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';

import { useTranslations } from '@/lib/i18n';

import { PinnedResourceCard } from '@/components/Resources/PinnedResourceCard';

const STALE_TIME = 30 * 1000;

/**
 * Read-only "Pinned Resources" list for the decision overview sidebar. There is
 * no dedicated pin flag — this surfaces the decision profile's resource
 * collection(s), the same data the side-panel Resources manager edits. Multiple
 * collections are flattened into one list (collections come back in sortKey
 * order, each list in item-sortKey order), with no headings to match the design.
 */
export const OverviewPinnedResourcesSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const t = useTranslations();
  const [collections] = trpc.resources.collections.list.useSuspenseQuery(
    { profileId },
    { staleTime: STALE_TIME },
  );

  const [lists] = trpc.useSuspenseQueries((tq) =>
    collections.items.map((collection) =>
      tq.resources.listByCollection(
        { collectionId: collection.id },
        { staleTime: STALE_TIME },
      ),
    ),
  );

  const items = lists.flatMap((list) => list.items);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <Header3 className="text-sm text-neutral-gray4">
        {t('Pinned Resources')}
      </Header3>
      <div className="flex flex-col gap-2">
        {items.map((resource) => (
          <PinnedResourceCard
            // A resource can sit in more than one collection, so scope the key
            // by collection to stay unique across the flattened list.
            key={`${resource.collectionId}:${resource.id}`}
            resource={resource}
            signedUrl={resource.signedUrl}
          />
        ))}
      </div>
    </section>
  );
};

export const PinnedResourcesSkeleton = () => (
  <div className="flex flex-col gap-2">
    <Skeleton className="h-12 w-full rounded-lg" />
    <Skeleton className="h-12 w-full rounded-lg" />
  </div>
);
