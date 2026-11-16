import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { cache } from 'react';

import { getTranslations } from '@/lib/i18n';

import { getDevelopEntryHeading } from '@/components/decisions/developProposalEditor/getDevelopEntryHeading';

import { DevelopProposalClient } from './DevelopProposalClient';

// cache() dedupes the reads across generateMetadata + page render (one
// request), so the data is fetched once and hydrates.
const fetchProposal = cache(async (profileId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getProposal.fetch({ profileId });
});

const fetchDecisionBySlug = cache(async (slug: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getDecisionBySlug.fetch({ slug });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;

  try {
    const [t, decisionProfile] = await Promise.all([
      getTranslations({ locale }),
      fetchDecisionBySlug(slug),
    ]);

    // The same heading the screen shows: the entry form's name.
    const heading = getDevelopEntryHeading({
      template:
        decisionProfile?.processInstance?.instanceData.proposalTemplate ?? null,
      fallback: t('decisions.developEditor.entryHeading'),
    });
    const decisionName = decisionProfile?.name;
    return {
      title: decisionName ? `${heading} | ${decisionName}` : heading,
    };
  } catch {
    return {};
  }
}

/**
 * Route page for the develop editor of an entry: a proposal developed from
 * origins in a develop phase. Any other proposal is not found here; it opens
 * at `/edit`.
 */
const DevelopProposalPage = async ({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) => {
  const { slug, profileId } = await params;
  const { queryClient } = await createServerUtils();

  // Shares the cache()-wrapped fetches with generateMetadata above. Swallow
  // failures: this only warms the cache — the client suspense queries
  // refetch and their error boundary owns errors.
  await Promise.all([
    fetchProposal(profileId),
    fetchDecisionBySlug(slug),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevelopProposalClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default DevelopProposalPage;
