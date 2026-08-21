'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal, ProposalRelationshipItem } from '@op/common/client';
import { Header3 } from '@op/sense/Header';
import { Suspense, useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import { formatBudget } from './BudgetDisplay';
import { ProposalMiniCardView } from './ProposalCard';

/**
 * "Contributing ideas" — the proposals merged into this one, listed as compact
 * proposal cards above the comments (Figma 15402:5056).
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

  // Pinning the target end asks what was merged INTO this proposal — the
  // opposite direction from the header's "Merged into …" notice.
  const [mergedIn] = trpc.decision.listProposalRelationships.useSuspenseQuery({
    targetProposalId: proposal.id,
  });

  if (mergedIn.relationships.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 border-t pt-8" aria-labelledby={headingId}>
      <Header3 id={headingId} className="text-label">
        {t('Contributing ideas')}
      </Header3>
      <ul className="flex flex-col gap-4">
        {mergedIn.relationships.map((relationship) => (
          <li key={relationship.id}>
            <ContributingIdeaCard
              relationship={relationship}
              decisionRoot={decisionRoot}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContributingIdeaCard({
  relationship,
  decisionRoot,
}: {
  relationship: ProposalRelationshipItem;
  decisionRoot: string;
}) {
  const { profile, budget, categories, submittedBy } = relationship.proposal;

  return (
    <ProposalMiniCardView
      // A proposal's title is its profile's name; the merge endpoint ships that
      // rather than re-resolving the title from the collaboration document.
      title={profile.name}
      href={`${decisionRoot}/proposal/${profile.id}`}
      budget={formatBudget(budget) ?? undefined}
      tags={categories}
      authors={
        submittedBy
          ? [
              {
                name: submittedBy.name,
                avatarSrc: submittedBy.avatarImageName
                  ? (getPublicUrl(submittedBy.avatarImageName) ?? undefined)
                  : undefined,
              },
            ]
          : undefined
      }
    />
  );
}
