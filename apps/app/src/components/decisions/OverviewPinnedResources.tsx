import { formatDate } from '@/utils/formatting';
import { createServerUtils } from '@op/api/server';
import { logger } from '@op/logging';
import { Separator } from '@op/sense/Separator';
import { Header3 } from '@op/ui/Header';

import { PinnedResourceCard } from '@/components/Resources/PinnedResourceCard';
import { TranslatedText } from '@/components/TranslatedText';

type ServerUtils = Awaited<ReturnType<typeof createServerUtils>>['utils'];

/**
 * Read-only "Pinned Resources" list for the decision overview sidebar, rendered
 * entirely on the server (no client JS, no realtime — read-mostly content).
 *
 * There is no dedicated pin flag — this surfaces the decision profile's resource
 * collection(s), the same data the side-panel Resources manager edits. Multiple
 * collections are flattened into one list (collections come back in sortKey
 * order, each list in item-sortKey order), with no headings to match the design.
 *
 * Owns its own leading Separator so the divider only renders when there's
 * something to show. Best-effort: a fetch failure renders nothing rather than
 * failing the page.
 */
export const OverviewPinnedResources = async ({
  profileId,
  utils,
}: {
  profileId: string;
  utils: ServerUtils;
}) => {
  let items;
  try {
    const collections = await utils.resources.collections.list.fetch({
      profileId,
    });
    const lists = await Promise.all(
      collections.items.map((collection) =>
        utils.resources.listByCollection.fetch({ collectionId: collection.id }),
      ),
    );
    items = lists.flatMap((list) => list.items);
  } catch (error) {
    logger.warn('Failed to server-render decision pinned resources', {
      profileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <Separator />
      <section className="flex flex-col gap-4">
        <Header3 className="text-sm text-neutral-gray4">
          <TranslatedText text="Pinned Resources" />
        </Header3>
        <div className="flex flex-col gap-2">
          {items.map((resource) => (
            <PinnedResourceCard
              // A resource can sit in more than one collection, so scope the key
              // by collection to stay unique across the flattened list.
              key={`${resource.collectionId}:${resource.id}`}
              resource={resource}
              signedUrl={resource.signedUrl}
              addedLabel={
                resource.createdAt ? (
                  <TranslatedText
                    text="Added {date}"
                    values={{ date: formatDate(resource.createdAt) }}
                  />
                ) : null
              }
            />
          ))}
        </div>
      </section>
    </>
  );
};
