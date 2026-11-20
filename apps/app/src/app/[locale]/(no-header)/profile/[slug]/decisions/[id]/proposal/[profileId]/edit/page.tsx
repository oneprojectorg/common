import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { cache } from 'react';

import { type Locale, getTranslations } from '@/lib/i18n';

import {
  type LegacySearchParams,
  redirectConvertedProposalEdit,
} from '../../../redirectConvertedInstance';
import { LegacyProposalEditClient } from './ProposalEditClient';

// cache() dedupes the reads across generateMetadata + page render (one request),
// so each resolver and its "viewed" event fire once and the data hydrates.
const fetchProposal = cache(async (profileId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getProposal.fetch({ profileId });
});

const fetchInstance = cache(async (instanceId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getInstance.fetch({ instanceId });
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{
    profileId: string;
    id: string;
    slug: string;
    locale: Locale;
  }>;
  searchParams: Promise<LegacySearchParams>;
}): Promise<Metadata> {
  const { profileId, id, slug, locale } = await params;

  // Redirecting here, before the loading boundary streams, gives link unfurlers a real 307; browsers still redirect client-side.
  await redirectConvertedProposalEdit({
    id,
    slug,
    locale,
    profileId,
    searchParams: await searchParams,
  });

  try {
    const [t, proposal, instance] = await Promise.all([
      getTranslations({ locale }),
      fetchProposal(profileId),
      fetchInstance(id),
    ]);

    const proposalTitle =
      proposal.profile?.name || t('decisions.proposals.untitledProposal');
    const label = `${proposalTitle} (${t('decisions.editingPageTitle')})`;
    return { title: instance?.name ? `${label} | ${instance.name}` : label };
  } catch {
    return {};
  }
}

const ProposalEditPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{
    profileId: string;
    id: string;
    slug: string;
    locale: Locale;
  }>;
  searchParams: Promise<LegacySearchParams>;
}) => {
  const { profileId, id, slug, locale } = await params;
  await redirectConvertedProposalEdit({
    id,
    slug,
    locale,
    profileId,
    searchParams: await searchParams,
  });
  const { queryClient } = await createServerUtils();

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
