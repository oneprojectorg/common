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

// cache() shares each read between generateMetadata and the page.
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

/** The develop editor of an entry. Any other proposal opens at `/edit`. */
const DevelopProposalPage = async ({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) => {
  const { slug, profileId } = await params;
  const { queryClient } = await createServerUtils();

  // Only warms the cache; the client's error boundary owns failures.
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
