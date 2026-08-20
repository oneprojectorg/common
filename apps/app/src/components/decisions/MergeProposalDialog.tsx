'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { MERGE_NOTE_MAX_LENGTH, type Proposal } from '@op/common/client';
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
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, Suspense, useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProposalCardData } from './ProposalCard/ProposalCardView';
import {
  type MergeCandidate,
  getMergeCandidates,
  getProposalDisplayTitle,
} from './mergeCandidates';
import { useProposalMergeActions } from './useProposalMergeActions';

/**
 * Candidates per page. The dialog shows them as cards, so this is also how many
 * cards a reviewer scrolls before reaching "Show more".
 */
const MERGE_CANDIDATE_PAGE_LIMIT = 50;

/**
 * Merging is two dialogs in Figma: pick the survivor (15311:11482), then confirm
 * what the merge does (15313:12547). One `Dialog` swaps its content between
 * them, so the backdrop doesn't flash and Back keeps the selection.
 */
type MergeStep = 'select' | 'confirm';

/**
 * "Merge proposals" — pick the proposal that survives, then confirm.
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
  const [step, setStep] = useState<MergeStep>('select');
  const [target, setTarget] = useState<MergeCandidate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [note, setNote] = useState('');
  const { merge, isMerging } = useProposalMergeActions();

  const sourceTitle = getProposalDisplayTitle(proposal, t('Untitled Proposal'));

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // The dialog unmounts its content, so a stale step, selection, or search
      // term would otherwise survive into the next open.
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
      await merge({
        sourceProposalId: proposal.id,
        sourceTitle,
        targetProposalId: target.id,
        targetTitle: target.title,
        note,
      });
      handleOpenChange(false);
    } catch (error) {
      // The hook already toasted it. Staying on the confirm step keeps the
      // selection, which is what a retry needs after a conflict ("already
      // merged", "unmerge those first") — the only failures this mutation has.
      logger.error('Failed to merge proposal', {
        error,
        context: 'MergeProposalDialog',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* `overflow-hidden p-0` + a `min-h-0 flex-1` body is the modal pattern
          from ProcessSurveyModal: the header and footer stay put and only the
          middle scrolls. */}
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
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </InputGroup>
              </Field>

              <section className="flex flex-col gap-2">
                <h3 className="text-muted-foreground">
                  {t('Suggested proposals')}
                </h3>
                {/* Its own boundary: a failed candidate list must leave the
                    dialog (and its close button) usable rather than taking the
                    page down. */}
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
                      searchTerm={searchTerm}
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
            isMerging={isMerging}
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
 * Figma also promises that likes, comments, and followers transfer, that
 * followers are notified, and that both activity logs record it, plus an
 * optional note for the author. `mergeProposals` does none of that — it inserts
 * one edge and takes no note — so only the consequence that is real is listed
 * here. The rest waits on the service.
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
  /** Superseded proposal's author, named in the note's label. Absent when anonymous. */
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
 * The decision's other proposals as a single-select list of cards. Reads the
 * same `listProposals` query the browse list does, so the page already on screen
 * is served from cache and the picker can't offer a proposal the list doesn't
 * show.
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
      className={cn('w-full', className)}
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
