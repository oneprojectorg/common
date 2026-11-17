import { ProposalRelationshipType } from '@op/api/encoders';
import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { cache } from 'react';

import { getTranslations, redirect } from '@/lib/i18n';

import { getDevelopEntryHeading } from '@/components/decisions/developProposalEditor/getDevelopEntryHeading';
import { decisionProposalDevelopHref } from '@/components/decisions/proposalHrefs';

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

/**
 * The develop screen of a proposal: the proposal beside the entry developed
 * from it. `profileId` is the proposal's; an entry's redirects to it.
 */
const DevelopProposalPage = async ({
  params,
}: {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}) => {
  const { slug, profileId, locale } = await params;
  const { utils, queryClient } = await createServerUtils();

  // These reads warm the cache; the client's error boundary owns failures.
  const [proposal] = await Promise.all([
    fetchProposal(profileId).catch(() => null),
    fetchDecisionBySlug(slug).catch(() => null),
  ]);

  if (proposal) {
    const [asEntry, asOrigin] = await Promise.all([
      utils.decision.listProposalRelationships
        .fetch({
          targetProposalId: proposal.id,
          relationshipType: ProposalRelationshipType.DEVELOPED,
        })
        .catch(() => null),
      // Same input as the read in `DevelopProposalRoute`, so it hydrates.
      utils.decision.listProposalRelationships
        .fetch({
          sourceProposalId: proposal.id,
          relationshipType: ProposalRelationshipType.DEVELOPED,
        })
        .catch(() => null),
    ]);

    const origin = asEntry?.items[0]?.proposal;
    if (origin) {
      redirect({
        href: decisionProposalDevelopHref({
          decisionSlug: slug,
          profileId: origin.profile.id,
        }),
        locale,
      });
    }

    const entry = asOrigin?.items[0]?.proposal;
    if (entry) {
      await fetchProposal(entry.profile.id).catch(() => null);
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevelopProposalClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default DevelopProposalPage;
