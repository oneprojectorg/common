import { getUser } from '@/utils/getUser';
import { isServerFeatureEnabled } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { cache } from 'react';

import { loadDecision } from './(decision-view)/loadDecision';

// As in the editor, the decision's own access decides who is an admin, network
// member or not; the flag is only read for an admin.
export const loadProcessAdmin = cache(async (slug: string) => {
  const [user, decision] = await Promise.all([getUser(), loadDecision(slug)]);

  if (!user || !decision.decisionProfile.processInstance.access?.admin) {
    forbidden();
  }

  const isEnabled = await isServerFeatureEnabled({
    key: 'new_process_admin_enabled',
    distinctId: user.authUserId,
  });

  if (!isEnabled) {
    notFound();
  }

  return decision;
});
