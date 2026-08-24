'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Header3 } from '@op/sense/Header';
import { Suspense, useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalCardView } from './ProposalCard';

/**
 * The proposals merged into this one, listed above the comments. A merge
 * records a link rather than moving content, so nothing else on the surviving
 * proposal shows what fed into it.
 */
export function ContributingIdeas({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  /** Route prefix, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  return (
    // A supplementary section shouldn't take the proposal page down with it.
    <APIErrorBoundary fallbacks={{ default: () => null }}>
      <Suspense fallback={null}>
        <ContributingIdeasSuspense
          proposal={proposal}
          decisionRoot={decisionRoot}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ContributingIdeasSuspense({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  decisionRoot: string;
}) {
  const t = useTranslations();
  const headingId = useId();

  const [contributing] =
    trpc.decision.listContributingProposals.useSuspenseQuery({
      proposalId: proposal.id,
    });

  if (contributing.proposals.length === 0) {
    return null;
  }

  return (
    <section className="border-t pt-8" aria-labelledby={headingId}>
      <div className="flex flex-col gap-2">
        <Header3 id={headingId} className="text-headline font-light">
          {t('Contributing ideas')}
        </Header3>
        <p className="text-base text-muted-foreground">
          {t('These participant ideas were merged into this proposal.')}
        </p>
      </div>
      <ul className="mt-6 flex flex-col gap-4">
        {contributing.proposals.map((contributingProposal) => (
          <li key={contributingProposal.id}>
            {/* No status badge: the remaining ones ("Shortlisted", "Not
                shortlisted") describe a candidacy that ended at the merge. */}
            <ProposalCardView
              proposal={contributingProposal}
              href={`${decisionRoot}/proposal/${contributingProposal.profileId}`}
              showStatusBadge={false}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
