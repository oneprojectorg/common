import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import type { Metadata } from 'next';

import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';

import { LegacyProposalViewClient } from './ProposalViewClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string; slug: string; id: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;

  // Title-only read: skipTracking avoids a duplicate "viewed" event.
  try {
    const client = await createClient();
    const proposal = await client.decision.getProposal({
      profileId,
      skipTracking: true,
    });
    const title = getProposalDisplayTitle(proposal);
    return title ? { title } : {};
  } catch {
    return {};
  }
}

const ProposalViewPage = async ({
  params,
}: {
  params: Promise<{ profileId: string; slug: string; id: string }>;
}) => {
  const { profileId, slug, id } = await params;
  const { utils, queryClient } = await createServerUtils();

  await utils.decision.getProposal.prefetch({ profileId }).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LegacyProposalViewClient
        profileId={profileId}
        orgSlug={slug}
        instanceId={id}
      />
    </HydrationBoundary>
  );
};

export default ProposalViewPage;
