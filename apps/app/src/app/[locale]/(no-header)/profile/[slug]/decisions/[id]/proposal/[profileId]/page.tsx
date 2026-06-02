import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';

import { LegacyProposalViewClient } from './ProposalViewClient';

const ProposalViewPage = async ({
  params,
}: {
  params: Promise<{ profileId: string; slug: string; id: string }>;
}) => {
  const { profileId, slug, id } = await params;
  const { utils, queryClient } = await createServerUtils();

  await utils.decision.getProposal.prefetch({ profileId }).catch(() => {});

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
