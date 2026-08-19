'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { ProposalCard } from '@op/sense/ProposalCard';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Separator } from '@op/sense/Separator';
import { Skeleton } from '@op/sense/Skeleton';
import { type ReactNode, Suspense, useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProposalCardData } from './ProposalCard/ProposalCardView';
import { getMergeCandidates, getProposalDisplayTitle } from './mergeCandidates';
import { useProposalMergeActions } from './useProposalMergeActions';

/**
 * Candidates per page. The dialog shows them as cards, so this is also how many
 * cards a reviewer scrolls before reaching "Show more".
 */
const MERGE_CANDIDATE_PAGE_LIMIT = 50;

/**
 * "Merge proposals" — pick the proposal that survives, then confirm
 * (Figma 15311:11482).
 *
 * Opened from the proposal card's `…` menu and from the proposal page's admin
 * menu. Merging records an edge — no content moves and no status changes — after
 * which `proposal` drops out of every listing, the voting pool, and the review
 * queues.
 */
export function MergeProposalDialog({
  proposal,
  open,
  onOpenChange,
}: {
  /** The proposal being merged away — the "Merging from" card. */
  proposal: Proposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const [targetProposalId, setTargetProposalId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { merge, isMerging } = useProposalMergeActions();

  const sourceTitle = getProposalDisplayTitle(proposal, t('Untitled Proposal'));

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // The dialog unmounts its list, so a stale selection or search term would
      // otherwise survive into the next open.
      setTargetProposalId(null);
      setSearchTerm('');
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async (targetTitle: string) => {
    if (!targetProposalId) {
      return;
    }

    try {
      await merge({
        sourceProposalId: proposal.id,
        sourceTitle,
        targetProposalId,
        targetTitle,
      });
      handleOpenChange(false);
    } catch (error) {
      // The hook already toasted it. Staying open keeps the selection, which is
      // what a retry needs after a conflict ("already merged", "unmerge those
      // first") — the only failures this mutation has.
      logger.error('Failed to merge proposal', {
        error,
        context: 'MergeProposalDialog',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-116">
        <DialogHeader>
          <DialogTitle className="text-center">
            {t('Merge proposals')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-6">
          <DialogDescription>
            {t.rich(
              'Select the proposal to merge <source>{name}</source> into. It keeps its own page, but leaves the proposal list, voting, and review.',
              {
                name: sourceTitle,
                source: (chunks: ReactNode) => <em>{chunks}</em>,
              },
            )}
          </DialogDescription>

          <section className="flex flex-col gap-2">
            <h3 className="text-muted-foreground">{t('Merging from')}</h3>
            <MergeProposalSummaryCard
              proposal={proposal}
              className="bg-muted"
            />
          </section>

          <Separator />

          <Field>
            <FieldLabel htmlFor="merge-proposal-search">
              {t('Merge into')}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <LuSearch className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="merge-proposal-search"
                type="search"
                placeholder={t('Search proposals…')}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </InputGroup>
          </Field>

          <section className="flex flex-col gap-2">
            <h3 className="text-muted-foreground">
              {t('Suggested proposals')}
            </h3>
            {/* Its own boundary: a failed candidate list must leave the dialog
                (and its close button) usable rather than taking the page down. */}
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
                  searchTerm={searchTerm}
                  selectedId={targetProposalId}
                  onSelect={setTargetProposalId}
                  onConfirm={handleConfirm}
                  isMerging={isMerging}
                />
              </Suspense>
            </APIErrorBoundary>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The decision's other proposals as a single-select list of cards. Reads the
 * same `listProposals` query the browse list does, so the page already on screen
 * is served from cache and the picker can't offer a proposal the list doesn't
 * show.
 *
 * Owns the footer too: "Continue" needs the selected candidate's title for the
 * toast, and only this component has the loaded candidates to resolve it from.
 */
function MergeCandidateListSuspense({
  proposal,
  searchTerm,
  selectedId,
  onSelect,
  onConfirm,
  isMerging,
}: {
  proposal: Proposal;
  searchTerm: string;
  selectedId: string | null;
  onSelect: (proposalId: string) => void;
  onConfirm: (targetTitle: string) => void;
  isMerging: boolean;
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
        searchTerm,
      }),
    [paginatedData.pages, proposal.id, untitledLabel, searchTerm],
  );

  const selected = candidates.find((candidate) => candidate.id === selectedId);

  return (
    <>
      {/* The empty state sits beside "Show more", not instead of it: a page can
          filter down to nothing (all drafts, all hidden, or no search match)
          while later pages still hold candidates. */}
      {candidates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {searchTerm
                ? t('No proposals match your search')
                : t('No other proposals yet')}
            </EmptyTitle>
            <EmptyDescription>
              {t(
                'A proposal can only be merged into another one in this decision.',
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <RadioGroup
          value={selectedId}
          onValueChange={(value) => onSelect(String(value))}
          aria-label={t('Proposal to merge into')}
        >
          {candidates.map((candidate) => (
            <Field key={candidate.id}>
              {/* The radio is the control but not the visual: the card carries
                  the selected treatment, so the label IS the card (Figma shows
                  no radio dot) while Base UI keeps the keyboard semantics. */}
              <RadioGroupItem
                id={`merge-target-${candidate.id}`}
                value={candidate.id}
                className="sr-only"
              />
              <FieldLabel
                htmlFor={`merge-target-${candidate.id}`}
                className="font-normal"
              >
                <MergeProposalSummaryCard
                  proposal={candidate.proposal}
                  selected={candidate.id === selectedId}
                  showDescription
                />
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      )}

      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => query.fetchNextPage()}
          loading={query.isFetchingNextPage}
        >
          {t('Show more proposals')}
        </Button>
      ) : null}

      <DialogFooter>
        <Button
          className="w-full sm:w-fit"
          onClick={() => selected && onConfirm(selected.title)}
          disabled={!selected}
          loading={isMerging}
        >
          {t('Continue')}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * A proposal as the merge dialog shows it: the sense `ProposalCard` with the
 * title, author, and category tags, and the body preview only for candidates
 * (Figma gives the "Merging from" card no description).
 */
function MergeProposalSummaryCard({
  proposal,
  selected,
  showDescription = false,
  className,
}: {
  proposal: Proposal;
  selected?: boolean;
  showDescription?: boolean;
  className?: string;
}) {
  const { titleText, budgetText, displayCategories, authors, description } =
    useProposalCardData(proposal);

  return (
    <ProposalCard
      title={titleText}
      budget={budgetText}
      tags={displayCategories}
      // Dropping each author's `href`: an anchor inside the radio's label would
      // be a second control competing with it for the click.
      authors={authors?.map(({ name, avatarSrc }) => ({ name, avatarSrc }))}
      description={showDescription ? description : undefined}
      selected={selected}
      className={className}
    />
  );
}

/** Two placeholder cards — the shape of a loaded candidate, not its content. */
function MergeCandidateListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
