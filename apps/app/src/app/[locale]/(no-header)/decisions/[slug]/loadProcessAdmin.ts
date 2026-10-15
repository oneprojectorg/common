import { getRequiredUser } from '@/utils/getUser';
import { isServerFeatureEnabled } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { cache } from 'react';

import { loadDecision } from './(decision-view)/loadDecision';

// The flag is read last so only admins cost a PostHog lookup.
export const loadProcessAdmin = cache(async (slug: string) => {
  const user = await getRequiredUser();
  const decision = await loadDecision(slug);

  if (!decision.decisionProfile.processInstance.access?.admin) {
    forbidden();
  }

  const isEnabled = await isServerFeatureEnabled(
    'new_process_admin_enabled',
    user.authUserId,
  );

  if (!isEnabled) {
    notFound();
  }

  return decision;
});
