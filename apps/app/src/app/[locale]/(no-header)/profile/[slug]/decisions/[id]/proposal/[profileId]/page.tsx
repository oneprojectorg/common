import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';
import { renderProposal } from '@/components/decisions/serverRenderData';

import { LegacyProposalViewClient } from './ProposalViewClient';

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
      renderProposal(profileId),
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

  await renderProposal(profileId).catch(() => {});

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
