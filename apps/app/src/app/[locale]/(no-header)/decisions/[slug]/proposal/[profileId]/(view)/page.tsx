import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ProposalRouteShell } from '../ProposalRouteShell';
import { loadProposal } from '../loadProposal';
import { ProposalViewClient } from './ProposalViewClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, profileId, locale } = await params;

  try {
    // Shares the cache()-wrapped fetch with the shell below, so the resolver
    // (and its view event) runs once per request.
    const [t, { proposal, decisionProfile }] = await Promise.all([
      getTranslations({ locale }),
      loadProposal({ slug, profileId }),
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

  return (
    <ProposalRouteShell slug={slug} profileId={profileId}>
      <ProposalViewClient profileId={profileId} slug={slug} />
    </ProposalRouteShell>
  );
};

export default ProposalViewPage;
