'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { MERGE_NOTE_MAX_LENGTH, type Proposal } from '@op/common/client';
import { useDebounce } from '@op/hooks';
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
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { ProposalCard } from '@op/sense/ProposalCard';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Separator } from '@op/sense/Separator';
import { Skeleton } from '@op/sense/Skeleton';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, Suspense, useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProposalCardData } from './ProposalCard/ProposalCardView';
import {
  type MergeCandidate,
  getMergeCandidates,
  getProposalDisplayTitle,
} from './proposals/merge';

const MERGE_CANDIDATE_PAGE_LIMIT = 50;

/** Suggestions are a shortlist, not a browse list — the search box is for the rest. */
const MERGE_SUGGESTION_LIMIT = 3;

/** Figma has these as two dialogs (15311:11482, 15313:12547); one swaps content
 *  between them so the backdrop doesn't flash and Cancel keeps the selection. */
type MergeStep = 'select' | 'confirm';

/**
 * "Merge proposals" — pick the proposal that survives, then confirm.
 *
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
  const [step, setStep] = useState<MergeStep>('select');
  const [target, setTarget] = useState<MergeCandidate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // The candidate list is a suspense query, so an un-debounced term would
  // re-suspend to the skeleton on every keystroke.
  const [debouncedSearchTerm] = useDebounce(searchTerm.trim(), 200);
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
      // Already toasted by `onError`; staying on this step keeps the selection
      // for a retry, which is what the conflict failures need.
      logger.error('Failed to merge proposal', {
        error,
        context: 'MergeProposalDialog',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* ProcessSurveyModal's pattern: header and footer stay put, body scrolls. */}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-116">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === 'select' ? t('Merge proposals') : t('Confirm merge')}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
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
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      // A new search can hide the selected card; keeping it
                      // would leave Continue enabled on an invisible choice.
                      setTarget(null);
                    }}
                  />
                </InputGroup>
              </Field>

              <section className="flex flex-col gap-2">
                <h3 className="text-muted-foreground">
                  {t('Suggested proposals')}
                </h3>
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
                      searchTerm={debouncedSearchTerm}
                      selected={target}
                      onSelect={setTarget}
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
 * Step two (Figma 15313:12547): spell out what the merge does, then commit.
 *
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
  const source = (chunks: ReactNode) => <em>{chunks}</em>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <DialogDescription>
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
              ? t('Add a note for {name}', { name: authorName })
              : t('Add a note')}{' '}
            <span className="font-normal text-muted-foreground">
              {t('Optional')}
            </span>
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
          {t('Confirm Merge')}
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * The decision's other proposals as a single-select list of cards. Reads
 * `listProposals`, so the picker is scoped exactly like the browse list and
 * can't offer something that list wouldn't show.
 *
 * With no search term this is a real suggestion list: the server ranks the other
 * proposals by how many title words they share with this one and returns a
 * single page, of which the top few are shown. Typing switches it back to a
 * paged search over the user's own words.
 */
function MergeCandidateListSuspense({
  proposal,
  searchTerm,
  selected,
  onSelect,
}: {
  proposal: Proposal;
  searchTerm: string;
  selected: MergeCandidate | null;
  onSelect: (candidate: MergeCandidate) => void;
}) {
  const t = useTranslations();
  const isSearching = searchTerm.length > 0;

  const [paginatedData, query] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId: proposal.processInstanceId,
        dir: 'desc',
        // A full page either way. Suggestions show only the top few, but they
        // are picked from the whole page: drafts, hidden and flagged proposals
        // are filtered out client-side (`getMergeCandidates`), and an admin —
        // who sees every draft in the decision — could otherwise have a short
        // fetch fill up with rows that never reach the list.
        limit: MERGE_CANDIDATE_PAGE_LIMIT,
        // Server-side, so a match beyond the loaded pages is still found.
        search: searchTerm || undefined,
        // Both modes run the same title search; they differ only in whose words
        // it gets. Once the user has typed, their words beat ours.
        similarToProposalId: isSearching ? undefined : proposal.id,
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
        limit: isSearching ? undefined : MERGE_SUGGESTION_LIMIT,
      }),
    [paginatedData.pages, proposal.id, untitledLabel, isSearching],
  );

  return (
    <>
      {/* Beside "Show more", not instead of it: a page can filter down to
          nothing while later pages still hold candidates. */}
      {candidates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {searchTerm
                ? t('No proposals match your search')
                : t('No similar proposals found')}
            </EmptyTitle>
            {/* Suggestions are a filtered list now, so an empty one usually
                means "nothing shares a word", not "nothing exists" — point at
                the search box rather than implying there is nothing to merge. */}
            <EmptyDescription>
              {searchTerm
                ? t(
                    'A proposal can only be merged into another one in this decision.',
                  )
                : t('Search for the proposal you want to merge into.')}
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
        >
          {candidates.map((candidate) => (
            <Field key={candidate.id} className="w-full">
              {/* Figma shows no radio dot, so the card is the label and carries
                  the selected treatment; the radio keeps the keyboard semantics. */}
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
    </>
  );
}

/** Figma gives the "Merging from" card no description, hence `showDescription`. */
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

/** Two placeholder cards, matching a loaded candidate's height. */
function MergeCandidateListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
