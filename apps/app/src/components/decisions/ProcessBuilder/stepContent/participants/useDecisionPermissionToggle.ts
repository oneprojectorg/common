import { trpc } from '@op/api/client';
import type { DecisionRolePermissions } from '@op/common';
import { toast } from '@op/sense/Toast';
import { debounceStrategy } from '@tanstack/db';
import { usePacedMutations } from '@tanstack/react-db';

import { useTranslations } from '@/lib/i18n';

import type { DecisionRolePermissionsRecord } from './roleCollections';
import { useRoleCollections } from './useRoleCollections';

/**
 * Toggles one decision permission of a role. The checkbox changes at once;
 * toggles less than `wait` apart merge into one write, because the endpoint
 * takes the whole permission object.
 */
export function useDecisionPermissionToggle({
  roleId,
  profileId,
}: {
  roleId: string;
  profileId: string;
}) {
  const t = useTranslations();
  const { client: trpcClient } = trpc.useUtils();
  const { decisionPermissions } = useRoleCollections(profileId);

  // The debounce timer is not tied to this component, so a toggle made just
  // before navigation still saves after unmount.
  return usePacedMutations<
    keyof DecisionRolePermissions,
    DecisionRolePermissionsRecord
  >({
    onMutate: (permission) => {
      decisionPermissions.update(roleId, (draft) => {
        draft.decisionPermissions[permission] =
          !draft.decisionPermissions[permission];
      });
    },
    mutationFn: async ({ transaction }) => {
      try {
        const savedRows = await Promise.all(
          transaction.mutations.map(({ key, modified }) =>
            trpcClient.profile.updateDecisionRoles.mutate({
              roleId: key,
              decisionPermissions: modified.decisionPermissions,
            }),
          ),
        );
        await decisionPermissions.utils.writeUpdate(savedRows);
      } catch (error) {
        toast.error(t('decisions.updateRoleError'));
        throw error;
      }
    },
    strategy: debounceStrategy({ wait: 300 }),
  });
}
