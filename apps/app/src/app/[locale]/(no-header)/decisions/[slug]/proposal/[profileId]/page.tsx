import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';

import { ProposalViewClient } from './ProposalViewClient';

const ProposalViewPage = async ({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) => {
  const { slug, profileId } = await params;
  const { utils, queryClient } = await createServerUtils();

  await Promise.all([
    utils.decision.getProposal.prefetch({ profileId }),
    utils.decision.getDecisionBySlug.prefetch({ slug }),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProposalViewClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default ProposalViewPage;
