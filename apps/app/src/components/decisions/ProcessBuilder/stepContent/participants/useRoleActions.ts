import { trpc } from '@op/api/client';
import type { DecisionRolePermissions } from '@op/common';
import { toast } from '@op/sense/Toast';
import { type Transaction, createOptimisticAction } from '@tanstack/db';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useRoleCollections } from './useRoleCollections';

export const DEFAULT_DECISION_PERMISSIONS: DecisionRolePermissions = {
  admin: false,
  create: false,
  read: false,
  update: false,
  delete: false,
  inviteMembers: false,
  review: false,
  submitProposals: false,
  vote: false,
  developProposals: false,
};

/**
 * Role writes that show in the table at once. Each one rolls back and shows an
 * error toast if the server rejects it.
 */
export function useRoleActions(profileId: string) {
  const t = useTranslations();
  const { client: trpcClient } = trpc.useUtils();
  const { roles, decisionPermissions } = useRoleCollections(profileId);

  const createRoleAction = useMemo(
    () =>
      createOptimisticAction<{
        name: string;
        permissions: DecisionRolePermissions;
      }>({
        onMutate: ({ name, permissions }) => {
          const unsavedRoleId = crypto.randomUUID();
          roles.insert({
            id: unsavedRoleId,
            name,
            description: null,
            isUnsaved: true,
          });
          decisionPermissions.insert({
            roleId: unsavedRoleId,
            decisionPermissions: permissions,
          });
        },
        mutationFn: async ({ name, permissions }) => {
          const role = await trpcClient.profile.createRole.mutate({
            profileId,
            zoneName: 'decisions',
            name,
            permissions: {
              admin: false,
              create: false,
              read: false,
              update: false,
              delete: false,
            },
          });

          let savedPermissions = DEFAULT_DECISION_PERMISSIONS;
          try {
            if (Object.values(permissions).some(Boolean)) {
              await trpcClient.profile.updateDecisionRoles.mutate({
                roleId: role.id,
                decisionPermissions: permissions,
              });
              savedPermissions = permissions;
            }
          } finally {
            // The role exists even if its permissions failed to save, so
            // write it before the unsaved row rolls back.
            await Promise.all([
              roles.utils.writeInsert(role),
              decisionPermissions.utils.writeInsert({
                roleId: role.id,
                decisionPermissions: savedPermissions,
              }),
            ]);
          }
        },
      }),
    [roles, decisionPermissions, trpcClient, profileId],
  );

  return {
    createRole: (input: {
      name: string;
      permissions: DecisionRolePermissions;
    }) =>
      toastWhenSettled(createRoleAction(input), {
        success: t('decisions.processBuilder.createRoleSuccess'),
        error: t('decisions.processBuilder.createRoleError'),
      }),
    renameRole: ({ roleId, name }: { roleId: string; name: string }) =>
      toastWhenSettled(
        roles.update(roleId, (draft) => {
          draft.name = name;
        }),
        {
          success: t('decisions.updateRoleSuccess'),
          error: t('decisions.updateRoleError'),
        },
      ),
    deleteRole: (roleId: string) =>
      toastWhenSettled(roles.delete(roleId), {
        success: t('decisions.processBuilder.deleteRoleSuccess'),
        error: t('decisions.processBuilder.deleteRoleError'),
      }),
  };
}

function toastWhenSettled<T extends object>(
  transaction: Transaction<T>,
  messages: { success: string; error: string },
) {
  transaction.when('settled').then(
    () => toast.success(messages.success),
    () => toast.error(messages.error),
  );
}
