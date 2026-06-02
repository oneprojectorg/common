import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';

import { renderProposal } from '@/lib/decisionRenderData';

import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';

import { LegacyProposalViewClient } from './ProposalViewClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string; slug: string; id: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;

  try {
    const proposal = await renderProposal(profileId);
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
  const { queryClient } = await createServerUtils();

  await renderProposal(profileId).catch(() => {});

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
