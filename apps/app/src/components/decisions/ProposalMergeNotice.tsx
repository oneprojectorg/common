'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { type ReactNode, Suspense } from 'react';
import { LuMerge } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { useMergeProposalsEnabled } from './useProposalMergeActions';

/**
 * "Merged into <survivor>" in the proposal page's header (Figma 15367:51167).
 *
 * A superseded proposal keeps its own page but is filtered out of every listing,
 * so without this the page reads as a normal proposal that has silently stopped
 * appearing anywhere. Pinned in the header rather than the body so it stays
 * visible at any scroll position.
 *
 * Renders nothing when the proposal hasn't been merged. Not admin-gated: the
 * link is the record of what happened, and `listProposalRelationships` is
 * READ-gated for exactly this render.
 */
export function ProposalMergeNotice({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  const mergeEnabled = useMergeProposalsEnabled();

  if (!mergeEnabled) {
    return null;
  }

  return (
    // Silent on failure: this is one line of context in a header, so a failed
    // read must not replace the page with an error, and there is nothing
    // actionable to say about it either.
    <APIErrorBoundary fallbacks={{ default: () => null }}>
      <Suspense fallback={null}>
        <ProposalMergeNoticeSuspense
          proposal={proposal}
          decisionRoot={decisionRoot}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ProposalMergeNoticeSuspense({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  decisionRoot: string;
}) {
  const t = useTranslations();

  // Pinning the source end asks "what did this proposal get merged into?" — at
  // most one row, since a proposal is superseded at most once.
  const [mergedAway] = trpc.decision.listProposalRelationships.useSuspenseQuery(
    {
      sourceProposalId: proposal.id,
    },
  );

  const supersededBy = mergedAway.relationships[0];

  if (!supersededBy) {
    return null;
  }

  return (
    <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <LuMerge className="size-4 shrink-0" aria-hidden />
      <span className="truncate">
        {t.rich('Merged into <target>{name}</target>', {
          name: supersededBy.proposal.profile.name,
          target: (chunks: ReactNode) => (
            <Link
              href={`${decisionRoot}/proposal/${supersededBy.proposal.profile.id}`}
              className="underline underline-offset-3 hover:text-foreground"
            >
              {chunks}
            </Link>
          ),
        })}
      </span>
    </p>
  );
}
