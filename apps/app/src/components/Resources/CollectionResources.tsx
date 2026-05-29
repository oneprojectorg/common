'use client';

import { trpc } from '@op/api/client';

import { ResourcesList } from './ResourcesList';

export const CollectionResourcesSuspense = ({
  collectionId,
  canManage,
}: {
  collectionId: string;
  canManage: boolean;
}) => {
  const [data] = trpc.resources.listByCollection.useSuspenseQuery(
    { collectionId },
    { staleTime: 30 * 1000 },
  );

  if (data.items.length === 0) {
    return null;
  }

  return <ResourcesList data={data} canManage={canManage} />;
};
