import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';

import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';

import { LegacyProposalViewClient } from './ProposalViewClient';

// cache() dedupes the read across generateMetadata + page render (one request),
// so the resolver and its "viewed" event fire once and the data hydrates.
const fetchProposal = cache(async (profileId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getProposal.fetch({ profileId });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    profileId: string;
    slug: string;
    id: string;
    locale: string;
  }>;
}): Promise<Metadata> {
  const { profileId, locale } = await params;

  try {
    const [t, proposal] = await Promise.all([
      getTranslations({ locale }),
      fetchProposal(profileId),
    ]);
    return {
      title: getProposalDisplayTitle(proposal) || t('Untitled Proposal'),
    };
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

  await fetchProposal(profileId).catch(() => {});

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
