import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import type { Metadata } from 'next';

import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';

import { ProposalViewClient } from './ProposalViewClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}): Promise<Metadata> {
  const { slug, profileId } = await params;

  // Title-only reads: skipTracking avoids firing a duplicate "viewed" event
  // (the page render below fires the real one).
  try {
    const client = await createClient();
    const [proposal, decisionProfile] = await Promise.all([
      client.decision.getProposal({ profileId, skipTracking: true }),
      client.decision.getDecisionBySlug({ slug }),
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
  const { utils, queryClient } = await createServerUtils();

  await Promise.all([
    utils.decision.getProposal.prefetch({ profileId }),
    utils.decision.getDecisionBySlug.prefetch({ slug }),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProposalViewClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default ProposalViewPage;
