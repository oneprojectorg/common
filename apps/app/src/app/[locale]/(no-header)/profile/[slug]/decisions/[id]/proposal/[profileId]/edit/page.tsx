import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';

import { LegacyProposalEditClient } from './ProposalEditClient';

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
    const [{ utils }, t] = await Promise.all([
      createServerUtils(),
      getTranslations({ locale }),
    ]);
    const [proposal, instance] = await Promise.all([
      utils.decision.getProposal.fetch({ profileId }, { staleTime: 30_000 }),
      utils.decision.getInstance.fetch(
        { instanceId: id },
        { staleTime: 30_000 },
      ),
    ]);

    const proposalTitle = getProposalDisplayTitle(proposal);
    if (!proposalTitle) {
      return {};
    }

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
  const { utils, queryClient } = await createServerUtils();

  await Promise.all([
    utils.decision.getProposal.prefetch({ profileId }, { staleTime: 30_000 }),
    utils.decision.getInstance.prefetch(
      { instanceId: id },
      { staleTime: 30_000 },
    ),
  ]).catch(() => {});

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
