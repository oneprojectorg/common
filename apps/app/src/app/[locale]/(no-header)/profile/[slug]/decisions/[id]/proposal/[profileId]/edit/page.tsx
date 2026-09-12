import { HydrationBoundary, createServerTRPC, dehydrate } from '@op/api/server';
import type { Metadata } from 'next';
import { cache } from 'react';

import { getTranslations } from '@/lib/i18n';

import { LegacyProposalEditClient } from './ProposalEditClient';

// cache() dedupes the reads across generateMetadata + page render (one request),
// so each resolver and its "viewed" event fire once and the data hydrates.
const fetchProposal = cache(async (profileId: string) => {
  const { trpc, queryClient } = await createServerTRPC();
  return queryClient.fetchQuery(
    trpc.decision.getProposal.queryOptions({ profileId }),
  );
});

const fetchInstance = cache(async (instanceId: string) => {
  const { trpc, queryClient } = await createServerTRPC();
  return queryClient.fetchQuery(
    trpc.decision.getInstance.queryOptions({ instanceId }),
  );
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    profileId: string;
    id: string;
    slug: string;
    locale: string;
  }>;
}): Promise<Metadata> {
  const { profileId, id, locale } = await params;

  try {
    const [t, proposal, instance] = await Promise.all([
      getTranslations({ locale }),
      fetchProposal(profileId),
      fetchInstance(id),
    ]);

    const proposalTitle = proposal.profile?.name || t('Untitled Proposal');
    const label = `${proposalTitle} (${t('Editing')})`;
    return { title: instance?.name ? `${label} | ${instance.name}` : label };
  } catch {
    return {};
  }
}

const ProposalEditPage = async ({
  params,
}: {
  params: Promise<{ profileId: string; id: string; slug: string }>;
}) => {
  const { profileId, id, slug } = await params;
  const { queryClient } = await createServerTRPC();

  await Promise.all([fetchProposal(profileId), fetchInstance(id)]).catch(
    () => {},
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LegacyProposalEditClient
        profileId={profileId}
        instanceId={id}
        decisionSlug={slug}
      />
    </HydrationBoundary>
  );
};

export default ProposalEditPage;
