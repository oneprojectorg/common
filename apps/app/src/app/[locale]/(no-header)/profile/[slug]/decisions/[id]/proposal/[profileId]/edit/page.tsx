import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { renderInstance, renderProposal } from '@/lib/decisionRenderData';

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
    const [t, proposal, instance] = await Promise.all([
      getTranslations({ locale }),
      renderProposal(profileId),
      renderInstance(id),
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
  const { queryClient } = await createServerUtils();

  await Promise.all([renderProposal(profileId), renderInstance(id)]).catch(
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
