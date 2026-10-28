'use client';

import { useUser } from '@/utils/UserProvider';
import type { Proposal } from '@op/common/client';

import { ProposalAdminMenu } from './ProposalAdminMenu';
import { getProposalAffordances } from './getProposalAffordances';

/**
 * The admin `…` menu for a proposal shown outside the proposal page, gated on
 * the same affordance the proposal page uses. Renders nothing for a viewer
 * who may not moderate.
 */
export function ProposalModerationMenu({
  instance,
  proposal,
  backHref,
}: {
  instance: Parameters<typeof getProposalAffordances>[0]['instance'];
  proposal: Proposal;
  backHref: string;
}) {
  const { user } = useUser();
  const { moderation } = getProposalAffordances({ instance, proposal, user });

  if (!moderation) {
    return null;
  }

  return <ProposalAdminMenu proposal={proposal} backHref={backHref} />;
}
