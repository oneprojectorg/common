'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { trpc } from '@op/api/client';
import { APP_NAME } from '@op/core';
import { notFound, useParams } from 'next/navigation';
import { useEffect } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DevelopProposalRoute } from '@/components/decisions/developProposalEditor/DevelopProposalRoute';

/**
 * Route page for the develop editor of an entry: a proposal developed from
 * origins in a develop phase. Any other proposal is not found here; it opens
 * at `/edit`.
 */
export default function DevelopProposalPage() {
  // Translates NOT_FOUND and FORBIDDEN from the suspense queries to 404/403.
  return (
    <ResourceErrorBoundary>
      <DevelopProposalPageContent />
    </ResourceErrorBoundary>
  );
}

function DevelopProposalPageContent() {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();
  const t = useTranslations();

  const [[decisionProfile, proposal]] = trpc.useSuspenseQueries((t) => [
    t.decision.getDecisionBySlug({ slug }),
    t.decision.getProposal({ profileId }),
  ]);

  if (!decisionProfile?.processInstance || !proposal) {
    notFound();
  }

  const proposalTitle = proposal.profile?.name;
  useEffect(() => {
    document.title = [
      proposalTitle
        ? `${proposalTitle} (${t('decisions.editingPageTitle')})`
        : null,
      decisionProfile.name,
      APP_NAME,
    ]
      .filter(Boolean)
      .join(' | ');
  }, [proposalTitle, decisionProfile.name, t]);

  return (
    <DevelopProposalRoute
      instance={decisionProfile.processInstance}
      proposal={proposal}
      decisionSlug={slug}
    />
  );
}
