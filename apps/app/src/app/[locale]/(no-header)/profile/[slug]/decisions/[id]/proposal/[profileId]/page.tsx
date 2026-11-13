import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { cache } from 'react';

import { type Locale, getTranslations } from '@/lib/i18n';

import { proposalHref } from '@/components/decisions/proposalHrefs';

import { redirectConvertedInstance } from '../../redirectConvertedInstance';
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
      title:
        proposal.profile?.name || t('decisions.proposals.untitledProposal'),
    };
  } catch {
    return {};
  }
}

const ProposalViewPage = async ({
  params,
}: {
  params: Promise<{
    profileId: string;
    slug: string;
    id: string;
    locale: Locale;
  }>;
}) => {
  const { profileId, slug, id, locale } = await params;
  await redirectConvertedInstance({
    instanceId: id,
    locale,
    href: (decisionSlug) =>
      proposalHref({ decisionSlug, profileId, slug, instanceId: id }),
  });
  const { queryClient } = await createServerUtils();

  // Swallow failures: this only warms the cache — the client suspense query
  // refetches and its error boundary owns errors, so a failed warmup must not
  // crash the route.
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
