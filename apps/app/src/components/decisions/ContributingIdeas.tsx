'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Header3 } from '@op/sense/Header';
import { Suspense, useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalCardView } from './ProposalCard';

/**
 * "Contributing ideas" — the proposals merged into this one, listed as cards
 * above the comments (Figma 15402:5056).
 *
 * Merging records a link rather than moving content, so without this the
 * surviving proposal gives no sign of what fed into it — only the merged-away
 * proposals carry the relationship, on a page nobody lands on. Renders nothing
 * when nothing was merged in, which is the common case.
 */
export function ContributingIdeas({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  return (
    // Silent on failure, like the merge notice: a supplementary section
    // shouldn't take the proposal page down with it.
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
  // Names the section for a screen reader — a proposal page has several
  // sibling regions ("Comments" below this one) and they can't all read as
  // "section".
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
        {/* An h3 like the sibling Comments heading — sized up to the design's
            headline step rather than promoted to an h2. */}
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
            {/* The browse card without its owner affordances: no `…` menu, no
                actions, and no engagement counts — a merged-away proposal is
                nobody's to manage or act on from here. The status badge goes
                too: the read already excludes drafts, hidden and flagged rows,
                so the only badges left ("Shortlisted", "Not shortlisted") speak
                about a candidacy that ended when the proposal was merged. */}
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
