import type { User } from '@op/supabase/lib';

import { CommonError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { decisionAdminPermissions } from './permissions';

export const assertDecisionAdmin = async ({
  user,
  decisionProfileId,
}: {
  user: User;
  decisionProfileId: string | null;
}): Promise<void> => {
  // Legacy instances can lack a profile.
  if (!decisionProfileId) {
    throw new CommonError('Decision profile not found');
  }

  await assertProfileAccess({
    user,
    profileId: decisionProfileId,
    permissions: decisionAdminPermissions,
  });
};
