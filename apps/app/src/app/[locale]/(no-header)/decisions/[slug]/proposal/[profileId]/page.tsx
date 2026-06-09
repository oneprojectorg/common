import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';

import { ProposalViewClient } from './ProposalViewClient';

// cache() dedupes the read across generateMetadata + page render (one request),
// so the resolver and its "viewed" event fire once and the data hydrates.
const fetchProposal = cache(async (profileId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getProposal.fetch({ profileId });
});

const fetchDecisionBySlug = cache(async (slug: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getDecisionBySlug.fetch({ slug });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, profileId, locale } = await params;

  try {
    const [t, proposal, decisionProfile] = await Promise.all([
      getTranslations({ locale }),
      fetchProposal(profileId),
      fetchDecisionBySlug(slug),
    ]);

    const proposalTitle = proposal.profile?.name || t('Untitled Proposal');
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
  // Swallow failures: this only warms the cache — the client suspense query
  // refetches and its error boundary owns errors, so a failed warmup must not
  // crash the route.
  await Promise.all([
    fetchProposal(profileId),
    fetchDecisionBySlug(slug),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProposalViewClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default ProposalViewPage;
