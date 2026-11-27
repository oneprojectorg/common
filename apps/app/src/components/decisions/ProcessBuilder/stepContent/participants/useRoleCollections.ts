import { useDbClient } from '@tanstack/react-db';
import { useMemo } from 'react';

import {
  getDecisionRolePermissionsCollectionOptions,
  getRolesCollectionOptions,
} from './roleCollections';

export function useRoleCollections(profileId: string) {
  const dbClient = useDbClient();

  return useMemo(
    () => ({
      roles: dbClient.collection(getRolesCollectionOptions(profileId)),
      decisionPermissions: dbClient.collection(
        getDecisionRolePermissionsCollectionOptions(profileId),
      ),
    }),
    [dbClient, profileId],
  );
}
