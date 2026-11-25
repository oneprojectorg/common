import { getQueryKey, trpc } from '@op/api/client';
import type { Role } from '@op/api/encoders';
import type { DecisionRolePermissions } from '@op/common';
import { collectionOptions } from '@tanstack/db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';

import { getDbClientDependencies } from '@/components/DbClientProvider';

export type RoleRecord = Role & {
  /** True on the optimistic row of a role that the server has not created yet. */
  isUnsaved?: boolean;
};

export type DecisionRolePermissionsRecord = {
  roleId: string;
  decisionPermissions: DecisionRolePermissions;
};

export function getRolesCollectionOptions(profileId: string) {
  return collectionOptions(`profile:${profileId}:roles`, (dbClient) => {
    const { queryClient, trpcClient } = getDbClientDependencies(dbClient);

    return queryCollectionOptions({
      ...getRolesQueryOptions({ profileId, trpcClient }),
      select: (response): RoleRecord[] => response.items,
      queryClient,
      getKey: (role) => role.id,

      onUpdate: async ({ transaction, collection }) => {
        const renamedRoles = await Promise.all(
          transaction.mutations.map(({ key, modified }) =>
            trpcClient.profile.updateRole.mutate({
              roleId: key,
              name: modified.name,
            }),
          ),
        );
        await collection.utils.writeUpdate(renamedRoles);
      },

      onDelete: async ({ transaction, collection }) => {
        await Promise.all(
          transaction.mutations.map(({ key }) =>
            trpcClient.profile.deleteRole.mutate({ roleId: key }),
          ),
        );
        await collection.utils.writeDelete(
          transaction.mutations.map(({ key }) => key),
        );
      },
    });
  });
}

export function getDecisionRolePermissionsCollectionOptions(profileId: string) {
  return collectionOptions(
    `profile:${profileId}:decisionRolePermissions`,
    (dbClient) => {
      const { queryClient, trpcClient } = getDbClientDependencies(dbClient);
      const rolesQueryOptions = getRolesQueryOptions({
        profileId,
        trpcClient,
      });

      return queryCollectionOptions({
        // Nested under the roles key, so realtime and `listRoles.invalidate()`
        // refetch the permissions of a role someone else added.
        queryKey: [...rolesQueryOptions.queryKey, 'decisionPermissions'],
        queryFn: async (): Promise<DecisionRolePermissionsRecord[]> => {
          const { items: roles } =
            await queryClient.fetchQuery(rolesQueryOptions);

          // One `getDecisionRole` per role; the batch link sends them in one
          // HTTP request, but the server still resolves each role on its own.
          return Promise.all(
            roles.map(async (role) => ({
              roleId: role.id,
              decisionPermissions:
                await trpcClient.profile.getDecisionRole.query({
                  roleId: role.id,
                  profileId,
                }),
            })),
          );
        },
        queryClient,
        getKey: (row) => row.roleId,
      });
    },
  );
}

/** The `listRoles` query the tRPC hooks use, so the collection shares its cache entry. */
function getRolesQueryOptions({
  profileId,
  trpcClient,
}: {
  profileId: string;
  trpcClient: ReturnType<typeof getDbClientDependencies>['trpcClient'];
}) {
  const input = { profileId, zoneName: 'decisions' };

  return {
    queryKey: getQueryKey(trpc.profile.listRoles, input, 'query'),
    queryFn: () => trpcClient.profile.listRoles.query(input),
  };
}
