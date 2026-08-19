'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@op/sense/Empty';
import { Field, FieldLabel } from '@op/sense/Field';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  type MergeCandidate,
  getMergeCandidates,
  getProposalDisplayTitle,
} from './mergeCandidates';
import { useProposalMergeActions } from './useProposalMergeActions';

/**
 * Candidates per page. Larger than the browse grid's 24 — the picker is a list
 * of titles, and a merge is easier to finish in one pass than in three.
 */
const MERGE_CANDIDATE_PAGE_LIMIT = 50;

/**
 * "Merge with another proposal": pick the proposal that survives, then confirm.
 *
 * Opened from the proposal card's `…` menu (Figma 15311:9078) and from the
 * proposal page's admin menu. Merging records an edge — no content moves and no
 * status changes — after which `proposal` drops out of every listing, the
 * voting pool, and the review queues.
 */
export function MergeProposalDialog({
  proposal,
  open,
  onOpenChange,
}: {
  /** The proposal being merged away. */
  proposal: Proposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const [target, setTarget] = useState<MergeCandidate | null>(null);
  const { merge, isMerging } = useProposalMergeActions();

  const sourceTitle = getProposalDisplayTitle(proposal, t('Untitled Proposal'));

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // The dialog unmounts its list, so a stale selection would otherwise
      // survive into the next open.
      setTarget(null);
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = () => {
    if (!target) {
      return;
    }

    merge({
      sourceProposalId: proposal.id,
      sourceTitle,
      targetProposalId: target.id,
      targetTitle: target.title,
    });
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Merge with another proposal')}</DialogTitle>
          <DialogDescription>
            {t(
              'Choose the proposal to keep. {source} keeps its own page, but leaves the proposal list, voting, and review.',
              { source: sourceTitle },
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Its own boundary: a failed candidate list must leave the dialog
              (and its Cancel button) usable rather than taking the page down. */}
          <APIErrorBoundary
            fallbacks={{
              default: () => (
                <p className="text-destructive" role="alert">
                  {t('Could not load the other proposals. Please try again.')}
                </p>
              ),
            }}
          >
            <Suspense fallback={<MergeCandidateListSkeleton />}>
              <MergeCandidateListSuspense
                proposal={proposal}
                selectedId={target?.id ?? null}
                onSelect={setTarget}
              />
            </Suspense>
          </APIErrorBoundary>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            onClick={() => handleOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            className="w-full sm:w-fit"
            onClick={handleConfirm}
            disabled={!target}
            loading={isMerging}
          >
            {t('Merge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The decision's other proposals as a single-select list. Reads the same
 * `listProposals` query the browse list does, so the page already on screen is
 * served from cache and the picker can't offer a proposal the list doesn't show.
 */
function MergeCandidateListSuspense({
  proposal,
  selectedId,
  onSelect,
}: {
  proposal: Proposal;
  selectedId: string | null;
  onSelect: (candidate: MergeCandidate) => void;
}) {
  const t = useTranslations();

  const [paginatedData, query] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId: proposal.processInstanceId,
        dir: 'desc',
        limit: MERGE_CANDIDATE_PAGE_LIMIT,
      },
      {
        getNextPageParam: (lastPage) => lastPage.next ?? undefined,
        staleTime: 30 * 1000,
      },
    );

  const untitledLabel = t('Untitled Proposal');
  const candidates = useMemo(
    () =>
      getMergeCandidates({
        proposals: paginatedData.pages.flatMap((page) => page.proposals),
        sourceProposalId: proposal.id,
        untitledLabel,
      }),
    [paginatedData.pages, proposal.id, untitledLabel],
  );

  if (candidates.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('No other proposals yet')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'A proposal can only be merged into another one in this decision.',
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <RadioGroup
        value={selectedId}
        onValueChange={(value) => {
          const candidate = candidates.find((item) => item.id === value);
          if (candidate) {
            onSelect(candidate);
          }
        }}
        aria-label={t('Proposal to merge into')}
      >
        {candidates.map((candidate) => (
          <Field
            key={candidate.id}
            orientation="horizontal"
            className="items-start rounded-md p-2 hover:bg-muted"
          >
            <RadioGroupItem
              id={`merge-target-${candidate.id}`}
              value={candidate.id}
              className="mt-1"
            />
            <FieldLabel
              htmlFor={`merge-target-${candidate.id}`}
              className="flex flex-col items-start gap-0.5 font-normal"
            >
              <span className="text-foreground">{candidate.title}</span>
              {candidate.authorName ? (
                <span className="text-muted-foreground">
                  {candidate.authorName}
                </span>
              ) : null}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>

      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-3 w-full"
          onClick={() => query.fetchNextPage()}
          loading={query.isFetchingNextPage}
        >
          {t('Show more proposals')}
        </Button>
      ) : null}
    </>
  );
}

/** Three placeholder rows — the shape of a loaded radio row, not its content. */
function MergeCandidateListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
