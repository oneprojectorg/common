import { getUser } from '@/utils/getUser';
import { assertWalledGardenAccess } from '@/utils/walledGarden';
import { isServerFeatureEnabled } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { cache } from 'react';

import { loadDecision } from './(decision-view)/loadDecision';

// Any real account may reach the admin gate: membership is decided by the
// decision's own access, not the network. The flag is read last so only admins
// cost a PostHog lookup.
export const loadProcessAdmin = cache(async (slug: string) => {
  const user = await assertWalledGardenAccess(await getUser(), {
    allowNonMembers: true,
  });
  const decision = await loadDecision(slug);

  if (!decision.decisionProfile.processInstance.access?.admin) {
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
