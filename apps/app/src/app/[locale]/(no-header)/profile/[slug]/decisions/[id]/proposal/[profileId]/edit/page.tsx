import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';

import { LegacyProposalEditClient } from './ProposalEditClient';

const ProposalEditPage = async ({
  params,
}: {
  params: Promise<{ profileId: string; id: string; slug: string }>;
}) => {
  const { profileId, id, slug } = await params;
  const { utils, queryClient } = await createServerUtils();

  await Promise.all([
    utils.decision.getProposal.prefetch({ profileId }),
    utils.decision.getInstance.prefetch({ instanceId: id }),
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
