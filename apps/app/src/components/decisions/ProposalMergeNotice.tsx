'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import { type ReactNode, Suspense, useState } from 'react';
import { LuMerge } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { getProposalDisplayTitle } from './mergeCandidates';
import { useProposalMergeActions } from './useProposalMergeActions';

/**
 * What merging did to this proposal, and the only way to undo it.
 *
 * Admin-only, because it is the pair of admin actions' receipt: a superseded
 * proposal is filtered out of every listing, so the "merged into this one" list
 * here is the sole reachable entry point for `unmergeProposal`. #1789 gates the
 * underlying read at `decisions: READ` for a public-facing render of the same
 * links, which no design covers yet.
 *
 * Renders nothing when this proposal is neither end of a live merge.
 */
export function ProposalMergeNotice({
  proposal,
  decisionRoot,
}: {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  if (proposal.access?.admin !== true) {
    return null;
  }

  return (
    // Its own boundary and fallback: this is supplementary admin context, so a
    // failed read must not take the proposal page down — but it says so rather
    // than vanishing, since a silent absence reads as "not merged".
    <APIErrorBoundary fallbacks={{ default: () => <MergeNoticeUnavailable /> }}>
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
  const { unmerge, isUnmerging } = useProposalMergeActions();
  // Which row's Unmerge was pressed, so only that button shows the spinner.
  const [unmergingProposalId, setUnmergingProposalId] = useState<string | null>(
    null,
  );

  const [[mergedAway, mergedIn]] = trpc.useSuspenseQueries((q) => [
    // Pinning the source end asks "what did this proposal get merged into?" —
    // at most one row, since a proposal is superseded at most once.
    q.decision.listProposalRelationships({ sourceProposalId: proposal.id }),
    // Pinning the target end asks "what was merged into this proposal?"
    q.decision.listProposalRelationships({ targetProposalId: proposal.id }),
  ]);

  // Mutually exclusive by construction: `mergeProposals` refuses a source that
  // already has proposals merged into it, and refuses a superseded target.
  const supersededBy = mergedAway.relationships[0];
  const mergedSources = mergedIn.relationships;

  if (!supersededBy && mergedSources.length === 0) {
    return null;
  }

  const handleUnmerge = (sourceProposalId: string, sourceTitle: string) => {
    setUnmergingProposalId(sourceProposalId);
    unmerge({ sourceProposalId, sourceTitle });
  };

  const proposalTitle = getProposalDisplayTitle(
    proposal,
    t('Untitled Proposal'),
  );

  return (
    <Alert variant="info">
      <LuMerge />
      <AlertTitle>
        {supersededBy
          ? t('Merged into another proposal')
          : t('Other proposals merged into this one')}
      </AlertTitle>
      <AlertDescription>
        {supersededBy ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t.rich(
                'This proposal has left the list, the voting pool, and the review queues. It was merged into <target>{name}</target>.',
                {
                  name: supersededBy.proposal.profile.name,
                  target: (chunks: ReactNode) => (
                    <Link
                      href={`${decisionRoot}/proposal/${supersededBy.proposal.profile.id}`}
                    >
                      {chunks}
                    </Link>
                  ),
                },
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUnmerge(proposal.id, proposalTitle)}
              disabled={isUnmerging}
              loading={unmergingProposalId === proposal.id && isUnmerging}
            >
              {t('Unmerge')}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {mergedSources.map((relationship) => (
              <li
                key={relationship.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <Link
                  href={`${decisionRoot}/proposal/${relationship.proposal.profile.id}`}
                >
                  {relationship.proposal.profile.name}
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleUnmerge(
                      relationship.proposal.id,
                      relationship.proposal.profile.name,
                    )
                  }
                  disabled={isUnmerging}
                  loading={
                    unmergingProposalId === relationship.proposal.id &&
                    isUnmerging
                  }
                >
                  {t('Unmerge')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

function MergeNoticeUnavailable() {
  const t = useTranslations();

  return (
    <Alert variant="info">
      <LuMerge />
      <AlertTitle>{t('Merge details unavailable')}</AlertTitle>
      <AlertDescription>
        {t('Could not check whether this proposal is part of a merge.')}
      </AlertDescription>
    </Alert>
  );
}
