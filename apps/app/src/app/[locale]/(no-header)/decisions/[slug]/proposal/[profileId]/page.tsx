import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';

import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';
import {
  renderDecisionBySlug,
  renderProposal,
} from '@/components/decisions/serverRenderData';

import { ProposalViewClient } from './ProposalViewClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}): Promise<Metadata> {
  const { slug, profileId } = await params;

  try {
    const [proposal, decisionProfile] = await Promise.all([
      renderProposal(profileId),
      renderDecisionBySlug(slug),
    ]);

    const proposalTitle = getProposalDisplayTitle(proposal);
    if (!proposalTitle) {
      return {};
    }

    const decisionName = decisionProfile?.name;
    return {
      title: decisionName
        ? `${proposalTitle} | ${decisionName}`
        : proposalTitle,
    };
  } catch {
    return {};
  }
}

const ProposalViewPage = async ({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) => {
  const { slug, profileId } = await params;
  const { queryClient } = await createServerUtils();

  // Shares the cache()-wrapped fetch with generateMetadata above, so the
  // resolver (and its view event) runs once and the data is hydrated.
  await Promise.all([
    renderProposal(profileId),
    renderDecisionBySlug(slug),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProposalViewClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default ProposalViewPage;
