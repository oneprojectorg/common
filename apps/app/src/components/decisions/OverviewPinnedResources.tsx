'use client';

import { trpc } from '@op/api/client';
import { Header3 } from '@op/sense/Header';
import { Separator } from '@op/sense/Separator';
import { Skeleton } from '@op/sense/Skeleton';

import { useTranslations } from '@/lib/i18n';

import { PinnedResourceCard } from '@/components/Resources/PinnedResourceCard';

/**
 * Read-only "Pinned Resources" list for the decision overview sidebar. There is
 * no dedicated pin flag — this surfaces the decision profile's resource
 * collection(s), the same data the side-panel Resources manager edits. Multiple
 * collections come back flattened into one list (collection sortKey order, then
 * item-sortKey order), with no headings to match the design. One query — the
 * server does the cross-collection read, replacing the old
 * collections.list + per-collection listByCollection fan-out.
 */
export const OverviewPinnedResourcesSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  const t = useTranslations();
  const [{ items }] = trpc.resources.list.useSuspenseQuery({
    profileId,
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {/* Divider lives here (not in the parent) so it renders only alongside
          actual resources — an empty list returns null above, no orphan rule. */}
      <Separator />
      <section className="flex flex-col gap-2">
        <Header3 className="font-sans text-sm text-neutral-gray4">
          {t('Pinned Resources')}
        </Header3>
        {items.map((resource) => (
          <PinnedResourceCard
            // A resource can sit in more than one collection, so scope the key
            // by collection to stay unique across the flattened list.
            key={`${resource.collectionId}:${resource.id}`}
            resource={resource}
            signedUrl={resource.signedUrl}
          />
        ))}
      </section>
    </>
  );
};

export const PinnedResourcesSkeleton = () => (
  <div className="flex flex-col gap-2">
    <Skeleton className="h-12 w-full rounded-lg" />
    <Skeleton className="h-12 w-full rounded-lg" />
  </div>
);

// Shown when the resource fetch errors. The endpoint shouldn't normally fail,
// but surfacing a line beats silently dropping the whole section.
export const PinnedResourcesError = () => {
  const t = useTranslations();
  return (
    <>
      <Separator />
      <section className="flex flex-col gap-2">
        <Header3 className="font-sans text-sm text-neutral-gray4">
          {t('Pinned Resources')}
        </Header3>
        <p className="text-neutral-charcoal">
          {t("Couldn't load pinned resources.")}
        </p>
      </section>
    </>
  );
};
