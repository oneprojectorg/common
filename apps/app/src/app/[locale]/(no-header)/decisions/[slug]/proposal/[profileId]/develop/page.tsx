import { ProposalRelationshipType } from '@op/api/encoders';
import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  const { utils, queryClient } = await createServerUtils();

  // These reads warm the cache; the client's error boundary owns failures.
  const [proposal] = await Promise.all([
    fetchProposal(profileId).catch(() => null),
    fetchDecisionBySlug(slug).catch(() => null),
  ]);

  // Same input as the read in `DevelopProposalRoute`, so it hydrates.
  const relationships = proposal
    ? await utils.decision.listProposalRelationships
        .fetch({
          targetProposalId: proposal.id,
          relationshipType: ProposalRelationshipType.DEVELOPED,
        })
        .catch(() => null)
    : null;

  if (relationships && relationships.items.length === 0) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevelopProposalClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default DevelopProposalPage;
