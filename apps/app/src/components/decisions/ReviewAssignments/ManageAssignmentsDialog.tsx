'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import {
  type AssignableProposal,
  PROPOSAL_SEARCH_MAX_LENGTH,
  type ReviewerAssignments,
  normalizeProposalCategories,
} from '@op/common/client';
import { useDebounce, useInfiniteScroll } from '@op/hooks';
import { logger } from '@op/logging/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldLabel } from '@op/sense/Field';
import { Header3 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import type { TranslateFn } from '@/lib/i18n';
import { useTranslations } from '@/lib/i18n';

import { useProposalCardData } from '../ProposalCard';
import { useCardTranslation } from '../ProposalTranslationContext';
import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { resolveProposalSystemFields } from '../proposalContentUtils';
import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';
import { ImportProposalIdsDialog } from './ImportProposalIdsDialog';

/** One row of the reviewer's queue, as `listReviewerAssignments` returns it. */
type QueueAssignment = ReviewerAssignments['items'][number];

/** How an "Add proposals" row behaves for this reviewer. */
type PickState = 'assigned' | 'own' | 'free';

interface ManageAssignmentsDialogContentProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  onSaved: () => void;
}

/**
 * The pick list pages, so it is sized for a scroll rather than a whole phase.
 * Every server-side cost of `listProposals` scales with this number.
 */
const PICK_PAGE_LIMIT = 24;

/**
 * The import's pool read is exhaustive, not scrolled, so it pays for the
 * fewest possible round trips.
 */
const IMPORT_POOL_PAGE_LIMIT = 100;

const SEARCH_DEBOUNCE_MS = 300;

const EMPTY_ASSIGNMENTS: QueueAssignment[] = [];

const EMPTY_PICK_ROWS: AssignableProposal[] = [];

export function ManageAssignmentsDialogContent(
  props: ManageAssignmentsDialogContentProps,
) {
  return (
    <DialogContent className="sm:max-h-152 sm:max-w-136 sm:overflow-hidden">
      {/* A child, not this component: the portal renders nothing until the
          dialog opens, so only hooks BELOW it are deferred to open — and
          unmounting on close is what resets the selection. */}
      <ManageAssignmentsBody {...props} />
    </DialogContent>
  );
}

function ManageAssignmentsBody({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  onSaved,
}: ManageAssignmentsDialogContentProps) {
  const t = useTranslations();
  const searchId = useId();
  const importEnabled = useFeatureFlag('bulk_assign_import');

  // State rather than a ref: the sentinel below reads this as its observer
  // root, so it has to re-render once the element is attached.
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);
  /** Proposal ids to assign. */
  const [toAssign, setToAssign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  /** Assignment ids to remove. */
  const [toUnassign, setToUnassign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  // Neither read suspends: the chrome paints at once and only the two lists
  // wait. The queue shares the page body's infinite cache entry, and no
  // staleTime is configured, so refetchOnMount must be off or opening the
  // dialog refires it — the body's observer owns the refetch and the channel
  // registration.
  const queueQuery = trpc.decision.listReviewerAssignments.useInfiniteQuery(
    { processInstanceId, phaseId, reviewerProfileId },
    {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      refetchOnMount: false,
    },
  );
  // Header, totals and eligibility describe the whole queue; any page carries them.
  const queue = queueQuery.data?.pages[0];
  const reviewer = queue?.reviewer ?? null;
  // Removal asserts the phase is current, so a past phase freezes the queue.
  const canModifyAssignments = queue?.canModifyAssignments === true;

  const assignments = useMemo(
    () =>
      queueQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_ASSIGNMENTS,
    [queueQuery.data?.pages],
  );
  // A reviewer without the role gets a frozen queue: unassign pending only.
  // An ended phase freezes both halves — `assignReviews` rejects a completed
  // phase and `removeReviewAssignments` requires the current one.
  const canAssign = queue?.isEligible === true && canModifyAssignments;
  // Loaded, and the read does not claim this profile reviews here.
  const isUnknownReviewer = Boolean(queue && !queue.reviewer);

  const pickQuery = trpc.decision.listAssignableProposals.useInfiniteQuery(
    {
      processInstanceId,
      phaseId,
      reviewerProfileId,
      limit: PICK_PAGE_LIMIT,
      // Blank is omitted to keep the untouched query key.
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    },
    {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      staleTime: 30 * 1000,
      // Hold the previous term's rows while the next query runs, so the list
      // doesn't empty and re-fill between keystrokes.
      placeholderData: (previous) => previous,
      enabled: !isUnknownReviewer,
    },
  );

  const pickProposals = useMemo(
    () =>
      pickQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_PICK_ROWS,
    [pickQuery.data?.pages],
  );

  // Every row states whether this reviewer already holds it, so a re-tick of
  // a row assigned since the page loaded is dropped rather than re-sent.
  const assignedPickIds = useMemo(
    () =>
      new Set(pickProposals.flatMap((row) => (row.assignment ? [row.id] : []))),
    [pickProposals],
  );

  const { fetchNextPage } = pickQuery;
  const loadNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);
  const { ref: sentinelRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextPage, {
      hasNextPage: pickQuery.hasNextPage,
      isFetchingNextPage: pickQuery.isFetchingNextPage,
      // Measured against the dialog's own scroller, not the viewport: a
      // viewport root is clipped by this container, which leaves `rootMargin`
      // no room to work and only fetches once the user is already at the
      // very bottom.
      root: scrollRoot,
    });

  const { fetchNextPage: fetchNextQueuePage } = queueQuery;
  const loadNextQueuePage = useCallback(() => {
    fetchNextQueuePage();
  }, [fetchNextQueuePage]);
  const { ref: queueSentinelRef, shouldShowTrigger: showQueueTrigger } =
    useInfiniteScroll<HTMLDivElement>(loadNextQueuePage, {
      hasNextPage: queueQuery.hasNextPage,
      isFetchingNextPage: queueQuery.isFetchingNextPage,
      root: scrollRoot,
    });

  const assignReviews = trpc.decision.assignReviews.useMutation();
  const removeAssignments = trpc.decision.removeReviewAssignments.useMutation();
  const isSaving = assignReviews.isPending || removeAssignments.isPending;

  // Off the queue and the selection, never off the loaded page: a selection
  // has to survive a search and a page fetch.
  const assignIds = canAssign
    ? [...toAssign].filter((id) => !assignedPickIds.has(id))
    : [];
  const unassignIds = assignments.flatMap((item) =>
    isRemovable(item, canModifyAssignments) &&
    toUnassign.has(item.assignment.id)
      ? [item.assignment.id]
      : [],
  );

  // Off the whole queue's count, not the loaded pages.
  const assignedCount =
    (queue?.total ?? 0) - unassignIds.length + assignIds.length;
  const hasChanges = assignIds.length > 0 || unassignIds.length > 0;

  // Additive only, and only over what is loaded: never bulk-unassigns.
  const loadedFreeIds = canAssign
    ? pickProposals.flatMap((row) =>
        pickStateOf(row) === 'free' ? [row.id] : [],
      )
    : [];
  const allLoadedFreeSelected =
    loadedFreeIds.length > 0 && loadedFreeIds.every((id) => toAssign.has(id));

  // Additive, like every other selection gesture here: an import never drops
  // rows the admin ticked by hand.
  const importProposals = (proposalIds: Array<string>) => {
    setToAssign((current) => new Set([...current, ...proposalIds]));
  };

  const toggleLoadedFree = () => {
    setToAssign((current) => {
      const next = new Set(current);
      for (const id of loadedFreeIds) {
        if (allLoadedFreeSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  // The `reviewAssignments` channel refetches the queue; nothing invalidates.
  // The two halves are separate mutations, so each reports its own failure —
  // one "could not save" toast after the assign half committed would lie.
  const save = async () => {
    let createdCount = 0;

    if (assignIds.length > 0) {
      try {
        const result = await assignReviews.mutateAsync({
          processInstanceId,
          phaseId,
          reviewerProfileId,
          proposalIds: assignIds,
        });
        createdCount = result.createdCount;
      } catch (error) {
        logger.error('Failed to save review assignment changes', {
          error,
          context: 'ManageAssignmentsDialog',
          reviewerProfileId,
        });
        // Nothing committed yet — every selection is still worth retrying.
        toast.error(t('decisions.review.saveChangesError'));
        return;
      }
    }

    let removedCount = 0;
    let skippedIds: string[] = [];

    if (unassignIds.length > 0) {
      try {
        const result = await removeAssignments.mutateAsync({
          processInstanceId,
          phaseId,
          assignmentIds: unassignIds,
        });
        skippedIds = result.skippedIds;
        removedCount = unassignIds.length - skippedIds.length;
      } catch (error) {
        logger.error('Failed to save review assignment changes', {
          error,
          context: 'ManageAssignmentsDialog',
          reviewerProfileId,
        });
        if (createdCount > 0) {
          // The assign half committed — drop it so a retry only re-sends the removals.
          setToAssign(new Set());
          toast.error(t('decisions.review.unassignPartialFailure'));
        } else {
          toast.error(t('decisions.review.saveChangesError'));
        }
        return;
      }
    }

    if (createdCount > 0 || removedCount > 0) {
      toast.success(summaryMessage(t, createdCount, removedCount));
    } else if (skippedIds.length === 0) {
      // Server deduped every pick; "0 unassigned" would read as a failure.
      toast.info(t('decisions.review.noChangesNeeded'));
    }

    // Skipped = no longer pending, for a reason the API doesn't report.
    if (skippedIds.length > 0) {
      toast.error(t('decisions.review.unassignConflictError'));
    }

    onSaved();
  };

  const name = reviewer
    ? (reviewer.name ?? reviewer.slug ?? reviewer.id)
    : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {name
            ? t('decisions.review.manageReviewerAssignmentsTitle', { name })
            : t('decisions.review.manageAssignmentsAction')}
        </DialogTitle>
        <DialogDescription>
          {t('decisions.review.manageAssignmentsHint')}
        </DialogDescription>
      </DialogHeader>

      {/* One scroller for both sections, and the sentinel's observer root:
          the assigned queue scrolls away as the admin works down the pick
          list, which is the order the task is done in. */}
      <div
        ref={setScrollRoot}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4"
      >
        {isUnknownReviewer ? (
          <p className="text-sm text-muted-foreground">
            {t('decisions.review.reviewerNotInPhase')}
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              {/* Not a field label — a moving count would rename the control. */}
              <Header3 aria-live="polite" className="font-light">
                {t('decisions.review.assignedCountHeading', {
                  count: assignedCount,
                })}
              </Header3>

              {queue && !canModifyAssignments ? (
                <p className="text-sm text-muted-foreground">
                  {t('decisions.review.phaseEndedAssignmentsLockedHint')}
                </p>
              ) : queue && !canAssign ? (
                <p className="text-sm text-muted-foreground">
                  {t('decisions.review.reviewerRoleRemovedHint')}
                </p>
              ) : null}

              <p aria-live="polite" className="sr-only">
                {queueQuery.isFetchingNextPage
                  ? t('decisions.review.loadingMoreProposals')
                  : ''}
              </p>

              {queueQuery.isPending ? (
                <RowSkeletons count={3} />
              ) : queueQuery.isError ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  {t('decisions.proposals.refreshPageHint')}
                </p>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('decisions.review.noReviewerAssignments')}
                </p>
              ) : (
                <ul className="flex flex-col rounded-lg border">
                  {assignments.map((item) => (
                    <AssignedRow
                      key={item.assignment.id}
                      item={item}
                      canModifyAssignments={canModifyAssignments}
                      isRemoved={toUnassign.has(item.assignment.id)}
                      onToggle={() =>
                        setToUnassign((current) =>
                          toggled(current, item.assignment.id),
                        )
                      }
                    />
                  ))}
                </ul>
              )}

              {showQueueTrigger ? (
                <div ref={queueSentinelRef} aria-hidden className="py-2">
                  {queueQuery.isFetchingNextPage ? (
                    <Skeleton className="h-10 w-full" />
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Header3 className="font-light">
                  {t('decisions.review.addProposalsHeading')}
                </Header3>
                <div className="flex items-center gap-2">
                  {/* Import builds the selection like Select all does, so it sits beside it. */}
                  {importEnabled && canAssign ? (
                    <ImportPoolAction
                      processInstanceId={processInstanceId}
                      phaseId={phaseId}
                      reviewerProfileId={reviewerProfileId}
                      onImport={importProposals}
                    />
                  ) : null}
                  <Button
                    variant="link"
                    onClick={toggleLoadedFree}
                    disabled={loadedFreeIds.length === 0}
                  >
                    {allLoadedFreeSelected ? t('Clear') : t('Select all')}
                  </Button>
                </div>
              </div>

              <Field>
                <FieldLabel htmlFor={searchId} className="sr-only">
                  {t('decisions.proposals.searchProposalsLabel')}
                </FieldLabel>
                <Input
                  id={searchId}
                  type="search"
                  value={search}
                  maxLength={PROPOSAL_SEARCH_MAX_LENGTH}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('decisions.review.searchByTitlePlaceholder')}
                />
              </Field>

              {/* Rendered unconditionally so the region exists before it has
                  anything to announce — a live region mounted with its text
                  already in place is never read out. */}
              <p aria-live="polite" className="sr-only">
                {pickQuery.isFetchingNextPage
                  ? t('decisions.review.loadingMoreProposals')
                  : pickQuery.isSuccess
                    ? t('decisions.review.proposalsShownCount', {
                        count: pickProposals.length,
                      })
                    : ''}
              </p>

              {pickQuery.isPending ? (
                <RowSkeletons count={5} />
              ) : pickQuery.isError ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  {t('decisions.proposals.mergeCandidatesLoadError')}
                </p>
              ) : pickProposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {debouncedSearch
                    ? t('decisions.review.noProposalsMatchQuery', {
                        query: debouncedSearch,
                      })
                    : t('decisions.review.noProposalsInPhase')}
                </p>
              ) : (
                <ul className="flex flex-col rounded-lg border">
                  {pickProposals.map((row) => {
                    const state = pickStateOf(row);

                    return (
                      <PickRow
                        key={row.id}
                        row={row}
                        state={state}
                        canAssign={canAssign}
                        isChecked={state === 'assigned' || toAssign.has(row.id)}
                        onToggle={() =>
                          setToAssign((current) => toggled(current, row.id))
                        }
                      />
                    );
                  })}
                </ul>
              )}

              {/* The sentinel's padding is load-bearing: a zero-height target
                  can never satisfy the hook's intersection threshold. It holds
                  no control, so it is never keyboard-reachable. */}
              {shouldShowTrigger ? (
                <div ref={sentinelRef} aria-hidden className="py-2">
                  {pickQuery.isFetchingNextPage ? (
                    <Skeleton className="h-10 w-full" />
                  ) : null}
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground sm:self-center"
        >
          {hasChanges
            ? t('decisions.review.assignHotkeyHint', {
                assign: assignIds.length,
                unassign: unassignIds.length,
              })
            : t('decisions.review.noChangesYet')}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <DialogClose render={<Button variant="outline" />}>
            {t('Cancel')}
          </DialogClose>
          <Button
            disabled={!hasChanges || isSaving}
            loading={isSaving}
            onClick={() => {
              void save();
            }}
          >
            {t('Save changes')}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/** A current assignment: removable while pending, read-only once started. */
function AssignedRow({
  item,
  canModifyAssignments,
  isRemoved,
  onToggle,
}: {
  item: QueueAssignment;
  canModifyAssignments: boolean;
  isRemoved: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const { titleText, displayCategories, authors } = useProposalCardData(
    item.assignment.proposal,
  );
  // A translated title is typed `string | string[]`, and the label interpolates
  // one string.
  const titleLabel = Array.isArray(titleText)
    ? titleText.join(', ')
    : titleText;
  const status = item.review?.state ?? item.assignment.status;
  const canRemove = isRemovable(item, canModifyAssignments);

  return (
    <li className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
      <span
        className={cn(
          'flex min-w-0 flex-col',
          isRemoved && 'text-muted-foreground line-through',
        )}
      >
        <span className="truncate" dir="auto">
          {titleText}
        </span>
        {authors?.[0]?.name ? (
          <span className="truncate text-sm text-muted-foreground" dir="auto">
            {authors[0].name}
          </span>
        ) : null}
      </span>
      <span className="ms-auto flex shrink-0 items-center gap-2">
        {displayCategories.length > 0 ? (
          <SelectionCategoryChips labels={displayCategories} />
        ) : null}
        <ReviewStatusBadge status={status} />
        {canRemove ? (
          <Button
            variant="link"
            // Replaces the visible word, so it names which row it acts on.
            aria-label={
              isRemoved
                ? t('decisions.review.keepProposalAssignedLabel', {
                    title: titleLabel,
                  })
                : t('decisions.review.removeProposalLabel', {
                    title: titleLabel,
                  })
            }
            onClick={onToggle}
          >
            {isRemoved ? t('editor.undoAction') : t('Remove')}
          </Button>
        ) : null}
      </span>
    </li>
  );
}

/** A phase proposal offered for assignment. */
function PickRow({
  row,
  state,
  canAssign,
  isChecked,
  onToggle,
}: {
  row: AssignableProposal;
  state: PickState;
  canAssign: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const { titleText, displayCategories } = useAssignableRowData(row);
  const authorName = row.author?.name;
  // An already-assigned row stays inert here even while its removal is
  // pending: the top section owns that assignment until Save runs.
  const isDisabled = state !== 'free' || !canAssign;

  return (
    <li className="border-b last:border-b-0">
      <Label
        className={cn(
          'flex items-center gap-2 px-3 py-2 font-normal',
          isDisabled ? 'text-muted-foreground' : 'hover:bg-muted/50',
        )}
      >
        <Checkbox
          checked={isChecked}
          disabled={isDisabled}
          onCheckedChange={onToggle}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate" dir="auto">
            {titleText}
          </span>
          {authorName ? (
            <span className="truncate text-sm text-muted-foreground" dir="auto">
              {authorName}
            </span>
          ) : null}
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-2">
          {state === 'own' ? (
            <Badge variant="outline">
              {t('decisions.review.reviewerOwnProposal')}
            </Badge>
          ) : null}
          {state === 'assigned' ? (
            <Badge variant="outline">
              {t('decisions.review.alreadyAssignedBadge')}
            </Badge>
          ) : null}
          {displayCategories.length > 0 ? (
            <SelectionCategoryChips labels={displayCategories} />
          ) : null}
        </span>
      </Label>
    </li>
  );
}

/**
 * The import's "N IDs not found" is a claim about the whole phase, so the pool
 * has to be complete before a paste can be classified — this pages it to
 * exhaustion instead of scrolling. Mounted only for the flagged cohort, which
 * is what keeps the phase-wide read off the common path.
 */
function ImportPoolAction({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  onImport,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  onImport: (proposalIds: Array<string>) => void;
}) {
  const poolQuery = trpc.decision.listAssignableProposals.useInfiniteQuery(
    {
      processInstanceId,
      phaseId,
      reviewerProfileId,
      limit: IMPORT_POOL_PAGE_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      staleTime: 30 * 1000,
    },
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = poolQuery;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const rows = useMemo(
    () =>
      poolQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_PICK_ROWS,
    [poolQuery.data?.pages],
  );

  const poolIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  const assignableIds = useMemo(
    () =>
      new Set(
        rows.flatMap((row) => (pickStateOf(row) === 'free' ? [row.id] : [])),
      ),
    [rows],
  );

  return (
    <ImportProposalIdsDialog
      poolIds={poolIds}
      assignableIds={assignableIds}
      onImport={onImport}
      disabled={poolQuery.isPending || hasNextPage}
    />
  );
}

function RowSkeletons({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

/**
 * An existing assignment outranks "own proposal" — a stray self-assignment
 * must stay visible in the top section and, while pending, removable. Both
 * facts come from the row, so a state here never depends on how many pages
 * of the reviewer's queue happen to be loaded.
 */
/**
 * Title and categories for a pick row, in the precedence
 * `useProposalCardData` applies: a card translation first, then the system
 * fields, then the proposal profile's name. The service already resolved the
 * system fields against the pinned document version, so there is nothing left
 * to resolve here.
 */
function useAssignableRowData(row: AssignableProposal) {
  const t = useTranslations();
  const cardTranslation = useCardTranslation(row.profileId);
  const { title, category } = resolveProposalSystemFields({
    proposalData: row.proposalData,
    proposalTemplate: null,
    documentContent: undefined,
  });

  return {
    titleText:
      cardTranslation?.title ??
      (title || row.profileName || t('decisions.proposals.untitledProposal')),
    displayCategories: cardTranslation?.category
      ? cardTranslation.category
      : normalizeProposalCategories(category),
  };
}

function pickStateOf(row: AssignableProposal): PickState {
  if (row.assignment) {
    return 'assigned';
  }
  return row.isOwn ? 'own' : 'free';
}

/**
 * Only an untouched assignment can be withdrawn: a started review is a record,
 * and `removeReviewAssignments` refuses a phase the instance has left.
 */
function isRemovable(
  item: QueueAssignment,
  canModifyAssignments: boolean,
): boolean {
  return canModifyAssignments && item.assignment.status === 'pending';
}

function toggled(
  current: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/** Whole messages per arm so a translator can order the clauses. */
function summaryMessage(
  // The root translator, not a namespaced one: `ReturnType<typeof
  // useTranslations>` now widens to every namespace's keys at once, which no
  // caller can satisfy.
  t: TranslateFn,
  createdCount: number,
  removedCount: number,
): string {
  if (createdCount > 0 && removedCount > 0) {
    return t('decisions.review.assignmentsSavedSummary', {
      created: createdCount,
      removed: removedCount,
    });
  }
  if (createdCount > 0) {
    return t('decisions.review.assignmentsCreatedCount', {
      count: createdCount,
    });
  }
  return t('decisions.review.proposalsUnassignedCount', {
    count: removedCount,
  });
}
