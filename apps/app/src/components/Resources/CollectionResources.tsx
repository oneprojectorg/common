'use client';

import { trpc } from '@op/api/client';

import { ResourcesList } from './ResourcesList';

export const CollectionResourcesSuspense = ({
  profileId,
  collectionId,
  canManage,
}: {
  profileId: string;
  collectionId: string;
  canManage: boolean;
}) => {
  const [data] = trpc.resources.listByCollection.useSuspenseQuery(
    { collectionId },
    { staleTime: 30 * 1000 },
  );

  // Managers still get a (droppable) list for empty collections so a file/link
  // can be dropped straight in; readers see nothing when there's nothing.
  if (data.items.length === 0 && !canManage) {
    return null;
  }

  return (
    <ResourcesList profileId={profileId} data={data} canManage={canManage} />
  );
};
