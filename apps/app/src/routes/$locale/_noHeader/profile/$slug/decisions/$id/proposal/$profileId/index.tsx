import { prefetchLegacyProposal } from '@/server/profileRoutes.functions';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { DecisionPageSkeleton } from '@/components/skeletons/DecisionSkeleton';

import { LegacyProposalViewClient } from './-ProposalViewClient';

export const Route = createFileRoute(
  '/$locale/_noHeader/profile/$slug/decisions/$id/proposal/$profileId/',
)({
  loader: async ({ params }) => {
    const [t, { dehydratedState, proposal }] = await Promise.all([
      getTranslations({ locale: params.locale }),
      prefetchLegacyProposal({ data: { profileId: params.profileId } }),
    ]);

    return {
      dehydratedState,
      title: proposal
        ? proposal.name || t('decisions.proposals.untitledProposal')
        : null,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: DecisionPageSkeleton,
  component: ProposalViewPage,
});

function ProposalViewPage() {
  const { profileId, slug, id } = Route.useParams();
  const { dehydratedState } = Route.useLoaderData();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <LegacyProposalViewClient
        profileId={profileId}
        orgSlug={slug}
        instanceId={id}
      />
    </HydrationBoundary>
  );
}
