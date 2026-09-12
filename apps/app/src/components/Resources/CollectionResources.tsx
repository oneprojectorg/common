'use client';
import { useTRPC } from '@op/api/client';
import { useSuspenseQuery } from '@tanstack/react-query';

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
  const trpc = useTRPC();
  const { data: data } = useSuspenseQuery(
    trpc.resources.listByCollection.queryOptions(
      { collectionId },
      { staleTime: 30 * 1000 },
    ),
  );

  const resources = data.items;

  // Managers still get a (droppable) list for empty collections so a file/link
  // can be dropped straight in; readers see nothing when there's nothing.
  if (resources.length === 0 && !canManage) {
    return null;
  }

  return (
    <ResourcesList profileId={profileId} data={data} canManage={canManage} />
  );
};
