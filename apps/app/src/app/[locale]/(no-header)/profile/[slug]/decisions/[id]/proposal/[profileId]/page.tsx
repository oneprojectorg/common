import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';

import { LegacyProposalViewClient } from './ProposalViewClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string; slug: string; id: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;

  try {
    const { utils } = await createServerUtils();
    const proposal = await utils.decision.getProposal.fetch(
      { profileId },
      { staleTime: 30_000 },
    );
    const title = proposal?.proposalData?.title;
    return title ? { title } : {};
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
  const { utils, queryClient } = await createServerUtils();

  await utils.decision.getProposal
    .prefetch({ profileId }, { staleTime: 30_000 })
    .catch(() => {});

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
