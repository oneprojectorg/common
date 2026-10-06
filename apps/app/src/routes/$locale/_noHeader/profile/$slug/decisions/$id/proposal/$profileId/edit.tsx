import { prefetchLegacyProposalEdit } from '@/server/profileRoutes.functions';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { DecisionPageSkeleton } from '@/components/skeletons/DecisionSkeleton';

import { LegacyProposalEditClient } from './-ProposalEditClient';

export const Route = createFileRoute(
  '/$locale/_noHeader/profile/$slug/decisions/$id/proposal/$profileId/edit',
)({
  loader: async ({ params }) => {
    const [t, { dehydratedState, titles }] = await Promise.all([
      getTranslations({ locale: params.locale }),
      prefetchLegacyProposalEdit({
        data: { profileId: params.profileId, instanceId: params.id },
      }),
    ]);

    if (!titles) {
      return { dehydratedState, title: null };
    }

    const proposalTitle =
      titles.proposalName || t('decisions.proposals.untitledProposal');
    const label = `${proposalTitle} (${t('decisions.editingPageTitle')})`;

    return {
      dehydratedState,
      title: titles.instanceName ? `${label} | ${titles.instanceName}` : label,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: DecisionPageSkeleton,
  component: ProposalEditPage,
});

function ProposalEditPage() {
  const { profileId, id, slug } = Route.useParams();
  const { dehydratedState } = Route.useLoaderData();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <LegacyProposalEditClient
        profileId={profileId}
        instanceId={id}
        decisionSlug={slug}
      />
    </HydrationBoundary>
  );
}
