'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { MERGE_NOTE_MAX_LENGTH, type Proposal } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
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
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { InputGroupAddon } from '@op/sense/InputGroup';
import { ProposalCard } from '@op/sense/ProposalCard';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Separator } from '@op/sense/Separator';
import { Skeleton } from '@op/sense/Skeleton';
import { Spinner } from '@op/sense/Spinner';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, Suspense, useId, useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProposalCardData } from './ProposalCard/ProposalCardView';
import {
  type MergeCandidate,
  getMergeCandidates,
  getProposalDisplayTitle,
} from './proposals/merge';

/** Shared by both pickers, so a search can reach whatever the list can. */
const MERGE_CANDIDATE_PAGE_LIMIT = 50;

// Stable identities: Base UI re-renders every option when either changes.
const getMergeCandidateLabel = (candidate: MergeCandidate) => candidate.title;
const isSameMergeCandidate = (a: MergeCandidate, b: MergeCandidate) =>
  a.id === b.id;

const source = (chunks: ReactNode) => <em>{chunks}</em>;

/** One dialog swaps between the two, so the backdrop doesn't flash. */
type MergeStep = 'select' | 'confirm';

/**
 * Merging records an edge: no content moves and no status changes, but
 * `proposal` drops out of every listing, the voting pool, and review.
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
  // Figma hides the search field's own label: this heading names the input and
  // the suggestion cards alike, so the input borrows it rather than adding one.
  const mergeIntoHeadingId = useId();
  const [step, setStep] = useState<MergeStep>('select');
  const [target, setTarget] = useState<MergeCandidate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [note, setNote] = useState('');
  // No invalidation needed: the endpoint registers the affected proposal channels.
  const mergeMutation = trpc.decision.mergeProposals.useMutation({
    onError: (error) => {
      toast.error(
        error.message || t('Could not merge this proposal. Please try again.'),
      );
    },
  });

  const sourceTitle = getProposalDisplayTitle(proposal, t('Untitled Proposal'));

  // Filling the field keeps it from ever naming a proposal other than the pick.
  // Dropping leaves it alone: that path is the user typing, which already set it.
  const handleSelect = (candidate: MergeCandidate | null) => {
    setTarget(candidate);
    if (candidate) {
      setSearchTerm(candidate.title);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // The content unmounts, so state would otherwise survive into the next open.
      setStep('select');
      setTarget(null);
      setSearchTerm('');
      setNote('');
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (!target) {
      return;
    }

    try {
      await mergeMutation.mutateAsync(
        {
          sourceProposalId: proposal.id,
          targetProposalId: target.id,
          note,
        },
        {
          // Per-call so the toast can name both ends; the input carries only ids.
          onSuccess: () =>
            toast.success(
              t('{source} has now been merged with {target}', {
                source: sourceTitle,
                target: target.title,
              }),
            ),
        },
      );
      handleOpenChange(false);
    } catch (error) {
      // Already toasted by `onError`; staying put keeps the selection for a retry.
      logger.error('Failed to merge proposal', {
        error,
        context: 'MergeProposalDialog',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-144">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? t('Merge proposal') : t('Confirm merge')}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pt-8 pb-10">
              {/* Figma renders this at body colour, not the muted default. */}
              <DialogDescription className="text-foreground">
                {t.rich(
                  'Select the proposal to merge <source>{name}</source> into. It keeps its own page, but leaves the proposal list, voting, and review.',
                  { name: sourceTitle, source },
                )}
              </DialogDescription>

              <section className="flex flex-col gap-4">
                <h3 className="font-serif text-label">{t('Merging from')}</h3>
                <MergeProposalSummaryCard
                  proposal={proposal}
                  className="bg-muted"
                />
              </section>

              {/* One heading over both pickers, per Figma: the field and the
                  suggestions are two ways of answering "merge into what?". */}
              <section className="flex flex-col gap-4">
                <h3 id={mergeIntoHeadingId} className="font-serif text-label">
                  {t('Merge into')}
                </h3>
                <MergeTargetSearchField
                  labelledBy={mergeIntoHeadingId}
                  proposal={proposal}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  selected={target}
                  onSelect={handleSelect}
                />

                {/* Scoped boundary: a failed list must leave the dialog usable. */}
                <APIErrorBoundary
                  fallbacks={{
                    default: () => (
                      <p className="text-destructive" role="alert">
                        {t(
                          'Could not load the other proposals. Please try again.',
                        )}
                      </p>
                    ),
                  }}
                >
                  <Suspense fallback={<MergeCandidateListSkeleton />}>
                    <MergeCandidateListSuspense
                      proposal={proposal}
                      selected={target}
                      onSelect={handleSelect}
                    />
                  </Suspense>
                </APIErrorBoundary>
              </section>
            </div>

            <DialogFooter>
              <Button
                className="w-full sm:w-auto"
                onClick={() => setStep('confirm')}
                disabled={!target}
              >
                {t('Continue')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <ConfirmMergeStep
            sourceTitle={sourceTitle}
            targetTitle={target?.title ?? ''}
            authorName={proposal.submittedBy?.name}
            note={note}
            onNoteChange={setNote}
            isMerging={mergeMutation.isPending}
            onBack={() => setStep('select')}
            onConfirm={handleConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Figma also lists engagement transfer, follower notification, and activity-log
 * entries. `mergeProposals` does none of those, so they aren't claimed here.
 */
function ConfirmMergeStep({
  sourceTitle,
  targetTitle,
  authorName,
  note,
  onNoteChange,
  isMerging,
  onBack,
  onConfirm,
}: {
  sourceTitle: string;
  targetTitle: string;
  /** Named in the note's label. Absent when the author is anonymous. */
  authorName?: string;
  note: string;
  onNoteChange: (note: string) => void;
  isMerging: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pt-8 pb-10">
        {/* Figma renders this at body colour, not the muted default. */}
        <DialogDescription className="text-foreground">
          {t.rich(
            'Merge <source>{name}</source> into <source>{target}</source>.',
            {
              name: sourceTitle,
              target: targetTitle,
              source,
            },
          )}
        </DialogDescription>

        <div className="flex flex-col gap-2">
          <p>{t('What happens:')}</p>
          <ul className="list-disc space-y-2 ps-5">
            <li>
              {t.rich(
                '<source>{name}</source> will be removed from the active proposals list. Its page stays viewable as a record.',
                { name: sourceTitle, source },
              )}
            </li>
          </ul>
        </div>

        <Separator />

        <Field>
          <FieldLabel htmlFor="merge-note">
            {authorName
              ? t('Add a note for {name} (optional)', { name: authorName })
              : t('Add a note (optional)')}
          </FieldLabel>
          <Textarea
            id="merge-note"
            value={note}
            maxLength={MERGE_NOTE_MAX_LENGTH}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={t(
              'Explain why these proposals were merged. This will be included in their notification.',
            )}
            className="min-h-24"
          />
          <FieldDescription>
            {t('{count} of {max} characters', {
              count: note.length,
              max: MERGE_NOTE_MAX_LENGTH,
            })}
          </FieldDescription>
        </Field>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onBack}
          disabled={isMerging}
        >
          {t('Cancel')}
        </Button>
        <Button
          className="w-full sm:w-auto"
          onClick={onConfirm}
          loading={isMerging}
        >
          {t('Confirm merge')}
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * Not a suspense query: suspending on a keystroke would blank the whole step.
 * That also keeps failures away from any error boundary, hence the in-popover
 * error line.
 */
function MergeTargetSearchField({
  labelledBy,
  proposal,
  searchTerm,
  onSearchTermChange,
  selected,
  onSelect,
}: {
  /** Id of the "Merge into" heading — Figma shows no label on the field. */
  labelledBy: string;
  proposal: Proposal;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  selected: MergeCandidate | null;
  /** `null` when the user edits the query, which drops the pick. */
  onSelect: (candidate: MergeCandidate | null) => void;
}) {
  const t = useTranslations();
  // Mirrors Base UI's popup state: a closed field doesn't search, and Escape
  // needs to know whether the list is open.
  const [isOpen, setIsOpen] = useState(false);
  const { results, hasQuery, isSearching, isError } = useMergeCandidateSearch({
    proposal,
    searchQuery: searchTerm.trim(),
    isOpen,
  });

  return (
    <Combobox
      items={results}
      value={selected}
      open={isOpen}
      onOpenChange={setIsOpen}
      // The server already filtered; a local pass would drop matches whose
      // title differs from the term the server matched on.
      filter={null}
      inputValue={searchTerm}
      onInputValueChange={(value, details) => {
        onSearchTermChange(value);
        // These three reasons are Base UI refilling the input from the
        // selection. Anything else is the user editing the query, which drops
        // the pick so `Continue` can't merge into a proposal the field no
        // longer names.
        if (
          details.reason !== 'item-press' &&
          details.reason !== 'list-navigation' &&
          details.reason !== 'none'
        ) {
          onSelect(null);
        }
      }}
      itemToStringLabel={getMergeCandidateLabel}
      isItemEqualToValue={isSameMergeCandidate}
      onValueChange={onSelect}
    >
      <ComboboxInput
        aria-labelledby={labelledBy}
        placeholder={t('Search proposals')}
        showTrigger={false}
        onKeyDown={(event) => {
          // With the list closed Base UI reads Escape as "clear the field" and
          // swallows the event, so the dialog never sees it. Its open-list
          // handling is correct, so only step in once the list is gone.
          if (event.key === 'Escape' && !isOpen) {
            event.preventBaseUIHandler();
          }
        }}
      >
        <InputGroupAddon align="inline-start">
          {/* Decorative: `ComboboxEmpty` announces "Searching…" already. */}
          {isSearching ? (
            <Spinner aria-hidden className="size-4 text-muted-foreground" />
          ) : (
            <LuSearch aria-hidden className="size-4" />
          )}
        </InputGroupAddon>
      </ComboboxInput>
      {/* Never conditionally rendered: unmounting this strands Base UI's close
          lifecycle and the popup reappears, inert, over the dialog. */}
      <ComboboxContent>
        <MergeSearchEmptyState
          hasQuery={hasQuery}
          isError={isError}
          isSearching={isSearching}
        />
        <ComboboxList>
          {(candidate: MergeCandidate) => (
            <ComboboxItem key={candidate.id} value={candidate}>
              <MergeSearchResult candidate={candidate} />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/** Only runs while the list is open: a field showing the pick isn't a query. */
function useMergeCandidateSearch({
  proposal,
  searchQuery,
  isOpen,
}: {
  proposal: Proposal;
  /** Trimmed. Empty means the field is not asking anything. */
  searchQuery: string;
  isOpen: boolean;
}) {
  const t = useTranslations();
  const [debouncedSearchQuery] = useDebounce(searchQuery, 200);
  const hasQuery = searchQuery.length > 0;

  const query = trpc.decision.listProposals.useQuery(
    {
      processInstanceId: proposal.processInstanceId,
      dir: 'desc',
      limit: MERGE_CANDIDATE_PAGE_LIMIT,
      // Server-side, so a match outside the suggestions below is still found.
      search: debouncedSearchQuery,
    },
    {
      enabled: isOpen && debouncedSearchQuery.length > 0,
      // Hold the previous results while the next query runs, so the popover
      // doesn't empty and re-fill between keystrokes.
      placeholderData: (previous) => previous,
      staleTime: 30 * 1000,
    },
  );

  const untitledLabel = t('Untitled Proposal');
  const results = useMemo(
    () =>
      // `placeholderData` outlives both a cleared field and a failed refetch,
      // so drop it in either case — otherwise the popup answers this query with
      // the last one's rows, and a non-empty list keeps Base UI from ever
      // rendering `ComboboxEmpty`, where the error message lives.
      hasQuery && !query.isError
        ? getMergeCandidates({
            proposals: query.data?.proposals ?? [],
            sourceProposalId: proposal.id,
            untitledLabel,
          })
        : [],
    [
      hasQuery,
      query.isError,
      query.data?.proposals,
      proposal.id,
      untitledLabel,
    ],
  );

  return {
    results,
    hasQuery,
    isError: query.isError,
    // Anything short of settled counts as searching: until then the rows on
    // screen are the previous term's. `isPaused` covers going offline, which
    // react-query parks rather than reporting as fetching.
    isSearching:
      isOpen &&
      hasQuery &&
      (query.isFetching ||
        query.isPaused ||
        searchQuery !== debouncedSearchQuery),
  };
}

/** Base UI renders this only while the list is empty, so all states share it. */
function MergeSearchEmptyState({
  hasQuery,
  isError,
  isSearching,
}: {
  hasQuery: boolean;
  isError: boolean;
  isSearching: boolean;
}) {
  const t = useTranslations();

  let message = t('No proposals match your search');
  if (!hasQuery) {
    message = t('Type to search proposals');
  } else if (isError) {
    message = t('Could not search proposals. Please try again.');
  } else if (isSearching) {
    message = t('Searching…');
  }

  return <ComboboxEmpty>{message}</ComboboxEmpty>;
}

function MergeSearchResult({ candidate }: { candidate: MergeCandidate }) {
  const { description } = useProposalCardData(candidate.proposal);

  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate" dir="auto">
        {candidate.title}
      </span>
      {description ? (
        <span className="truncate text-sm text-muted-foreground" dir="auto">
          {description}
        </span>
      ) : null}
    </div>
  );
}

/** Reads `listProposals`, so this can't offer what the browse list would hide. */
function MergeCandidateListSuspense({
  proposal,
  selected,
  onSelect,
}: {
  proposal: Proposal;
  selected: MergeCandidate | null;
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
  const loadedCandidates = useMemo(
    () =>
      getMergeCandidates({
        proposals: paginatedData.pages.flatMap((page) => page.proposals),
        sourceProposalId: proposal.id,
        untitledLabel,
      }),
    [paginatedData.pages, proposal.id, untitledLabel],
  );

  // Only one proposal can be merged into, so a pick collapses the list to it.
  // Rendered from `selected` rather than found here: search reaches proposals
  // these pages don't hold.
  const candidates = selected ? [selected] : loadedCandidates;

  return (
    <>
      {/* Beside "Show more", not instead of it: a page can filter down to
          nothing while later pages still hold candidates. */}
      {candidates.length === 0 ? (
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
      ) : (
        <RadioGroup
          value={selected?.id ?? null}
          onValueChange={(value) => {
            const candidate = candidates.find((item) => item.id === value);
            if (candidate) {
              onSelect(candidate);
            }
          }}
          aria-label={t('Proposal to merge into')}
          className="gap-4"
        >
          {candidates.map((candidate) => (
            <Field key={candidate.id} className="w-full">
              {/* No radio dot in Figma: the card is the label, the hidden radio
                  keeps the keyboard semantics. */}
              <RadioGroupItem
                id={`merge-target-${candidate.id}`}
                value={candidate.id}
                className="sr-only"
              />
              <FieldLabel
                htmlFor={`merge-target-${candidate.id}`}
                className="w-full font-normal"
              >
                <MergeProposalSummaryCard
                  proposal={candidate.proposal}
                  selected={candidate.id === selected?.id}
                  showDescription
                />
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      )}

      {/* Nothing to show more of while the list is collapsed to the pick. */}
      {query.hasNextPage && !selected ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => query.fetchNextPage()}
          loading={query.isFetchingNextPage}
        >
          {t('Show more proposals')}
        </Button>
      ) : null}
    </>
  );
}

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
      // Without `href`: an anchor inside the label would compete for the click.
      authors={authors?.map(({ name, avatarSrc }) => ({ name, avatarSrc }))}
      description={showDescription ? description : undefined}
      selected={selected}
      className={cn('w-full', className)}
    />
  );
}

function MergeCandidateListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
