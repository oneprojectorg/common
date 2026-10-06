import { prefetchProposalView } from '@/server/decisions.functions';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';

import { ProposalViewClient } from './-ProposalViewClient';

export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/proposal/$profileId/',
)({
  // One server read warms both queries, so the resolver (and its "viewed"
  // event) runs once and the data hydrates.
  loader: async ({ params }) => {
    const [t, { dehydratedState, titles }] = await Promise.all([
      getTranslations({ locale: params.locale }),
      prefetchProposalView({
        data: { slug: params.slug, profileId: params.profileId },
      }),
    ]);

    if (!titles) {
      return { dehydratedState, title: null };
    }

    const proposalTitle =
      titles.proposalName || t('decisions.proposals.untitledProposal');

    return {
      dehydratedState,
      title: titles.decisionName
        ? `${proposalTitle} | ${titles.decisionName}`
        : proposalTitle,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title ? [pageTitle(loaderData.title)] : [],
  }),
  // Scoped to the proposal view alone: `reviews` and `edit` are siblings with
  // their own pending states.
  pendingComponent: ProposalEditorSkeleton,
  component: ProposalViewPage,
});

function ProposalViewPage() {
  const { slug, profileId } = Route.useParams();
  const { dehydratedState } = Route.useLoaderData();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <ProposalViewClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
}
