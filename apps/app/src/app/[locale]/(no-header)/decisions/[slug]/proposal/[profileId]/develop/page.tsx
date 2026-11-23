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

import { isCurrentDevelopSource } from '@/components/decisions/developProposalEditor/isCurrentDevelopSource';
import { getSchemaName } from '@/components/decisions/getSchemaName';

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
  const { slug, profileId, locale } = await params;

  try {
    const [t, decisionProfile, proposal] = await Promise.all([
      getTranslations({ locale }),
      fetchDecisionBySlug(slug),
      fetchProposal(profileId),
    ]);

    const heading = getSchemaName({
      template: proposal.proposalTemplate ?? null,
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
 * The develop view of an entry, or of a source of the current develop phase
 * that has no entry. Any other proposal opens at `/edit`.
 */
const DevelopProposalPage = async ({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) => {
  const { slug, profileId } = await params;
  const { utils, queryClient } = await createServerUtils();

  // These reads warm the cache; the client's error boundary owns failures.
  const [proposal, decisionProfile] = await Promise.all([
    fetchProposal(profileId).catch(() => null),
    fetchDecisionBySlug(slug).catch(() => null),
  ]);

  const instance = decisionProfile?.processInstance;
  const canDevelop = Boolean(
    instance?.access?.admin || instance?.access?.developProposals,
  );

  // Same inputs as the reads in `DevelopProposalRoute`, so they hydrate.
  const [relationships] = await Promise.all([
    proposal
      ? utils.decision.listProposalRelationships
          .fetch({
            targetProposalId: proposal.id,
            relationshipType: ProposalRelationshipType.DEVELOPED,
          })
          .catch(() => null)
      : null,
    instance && canDevelop
      ? utils.decision.getDevelopConfirmState
          .fetch({ processInstanceId: instance.id })
          .catch(() => null)
      : null,
  ]);

  if (
    relationships &&
    relationships.items.length === 0 &&
    instance &&
    proposal &&
    !isCurrentDevelopSource({ instance, proposal })
  ) {
    notFound();
  }

  // The first source the column opens, so both panes reveal together.
  const firstSource = relationships?.items[0]?.proposal;
  if (firstSource) {
    await utils.decision.getProposal
      .fetch({ profileId: firstSource.profile.id })
      .catch(() => null);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevelopProposalClient profileId={profileId} slug={slug} />
    </HydrationBoundary>
  );
};

export default DevelopProposalPage;
