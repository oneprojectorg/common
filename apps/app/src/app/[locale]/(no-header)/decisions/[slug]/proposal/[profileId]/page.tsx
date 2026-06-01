import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';

import { ProposalViewClient } from './ProposalViewClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}): Promise<Metadata> {
  const { slug, profileId } = await params;

  try {
    const { utils } = await createServerUtils();
    const [proposal, decisionProfile] = await Promise.all([
      utils.decision.getProposal.fetch({ profileId }, { staleTime: 30_000 }),
      utils.decision.getDecisionBySlug.fetch({ slug }, { staleTime: 30_000 }),
    ]);

    const proposalTitle = proposal?.proposalData?.title;
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
    utils.decision.getProposal.prefetch({ profileId }, { staleTime: 30_000 }),
    utils.decision.getDecisionBySlug.prefetch({ slug }, { staleTime: 30_000 }),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProposalViewClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default ProposalViewPage;
