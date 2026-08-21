'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { type ReactNode, Suspense } from 'react';
import { LuMerge } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

/**
 * "Merged into <survivor>" in the proposal page's header (Figma 15367:51167).
 *
 * A superseded proposal keeps its page but leaves every listing, so without this
 * it reads as a normal proposal that silently stopped appearing anywhere.
 * Renders nothing when the proposal hasn't been merged.
 */
export function ProposalMergeNotice({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  return (
    // Silent on failure: one line of header context shouldn't take the page down.
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

  // Pinning the source end asks what this was merged into: at most one row.
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
