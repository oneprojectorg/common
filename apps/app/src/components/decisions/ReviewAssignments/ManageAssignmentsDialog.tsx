'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { ProposalStatus } from '@op/api/encoders';
import {
  PROPOSAL_SEARCH_MAX_LENGTH,
  type Proposal,
  type ReviewerAssignments,
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

import { useTranslations } from '@/lib/i18n';

import { useProposalCardData } from '../ProposalCard';
import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';
import { ImportProposalIdsDialog } from './ImportProposalIdsDialog';

/** One row of the reviewer's queue, as `listReviewerAssignments` returns it. */
type QueueAssignment = ReviewerAssignments['assignments'][number];

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

export function ManageAssignmentsDialogContent(
  props: ManageAssignmentsDialogContentProps,
) {
  return (
    // 34rem × 38rem — the size the design's dialog was composed at.
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
  // wait. The queue shares the page body's cache entry, and no staleTime is
  // configured, so refetchOnMount must be off or opening the dialog refires
  // it — the body's observer owns the refetch and the channel registration.
  const queueQuery = trpc.decision.listReviewerAssignments.useQuery(
    { processInstanceId, phaseId, reviewerProfileId },
    { refetchOnMount: false },
  );
  const queue = queueQuery.data;
  const reviewer = queue?.reviewer ?? null;
  const assignments = queue?.assignments ?? EMPTY_ASSIGNMENTS;
  // A reviewer without the role gets a frozen queue: unassign pending only.
  const canAssign = queue?.isEligible === true;
  // Loaded, and the read does not claim this profile reviews here.
  const isUnknownReviewer = Boolean(queue && !queue.reviewer);

  const assignedProposalIds = useMemo(
    () => new Set(assignments.map((item) => item.assignment.proposal.id)),
    [assignments],
  );

  const pickQuery = trpc.decision.listProposals.useInfiniteQuery(
    {
      processInstanceId,
      phaseId,
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
    () => collectAssignableProposals(pickQuery.data?.pages),
    [pickQuery.data?.pages],
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

  const assignReviews = trpc.decision.assignReviews.useMutation();
  const removeAssignments = trpc.decision.removeReviewAssignments.useMutation();
  const isSaving = assignReviews.isPending || removeAssignments.isPending;

  // Off the queue and the selection, never off the loaded page: a selection
  // has to survive a search and a page fetch.
  const assignIds = canAssign
    ? [...toAssign].filter((id) => !assignedProposalIds.has(id))
    : [];
  const unassignIds = assignments.flatMap((item) =>
    isRemovable(item) && toUnassign.has(item.assignment.id)
      ? [item.assignment.id]
      : [],
  );

  const assignedCount =
    assignments.length - unassignIds.length + assignIds.length;
  const hasChanges = assignIds.length > 0 || unassignIds.length > 0;

  // Additive only, and only over what is loaded: never bulk-unassigns.
  const loadedFreeIds = canAssign
    ? pickProposals.flatMap((proposal) =>
        pickStateOf(proposal, assignedProposalIds, reviewerProfileId) === 'free'
          ? [proposal.id]
          : [],
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
        toast.error(t('Could not save the changes. Please try again.'));
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
          toast.error(
            t('Assignments were saved, but unassigning failed — try again.'),
          );
        } else {
          toast.error(t('Could not save the changes. Please try again.'));
        }
        return;
      }
    }

    if (createdCount > 0 || removedCount > 0) {
      toast.success(summaryMessage(t, createdCount, removedCount));
    } else if (skippedIds.length === 0) {
      // Server deduped every pick; "0 unassigned" would read as a failure.
      toast.info(t('No changes were needed.'));
    }

    // Skipped = no longer pending, for a reason the API doesn't report.
    if (skippedIds.length > 0) {
      toast.error(t('Could not unassign — the assignment has changed.'));
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
            ? t("Manage {name}'s assignments", { name })
            : t('Manage assignments')}
        </DialogTitle>
        <DialogDescription>
          {t(
            "Remove a pending assignment, or check a proposal to add it. Started reviews can't be removed.",
          )}
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
            {t('This person does not review in this phase.')}
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              {/* Not a field label — a moving count would rename the control. */}
              <Header3 aria-live="polite" className="font-light">
                {t('Assigned ({count})', { count: assignedCount })}
              </Header3>

              {queue && !canAssign ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'This reviewer no longer has the reviewer role, so they cannot take new proposals.',
                  )}
                </p>
              ) : null}

              {queueQuery.isPending ? (
                <RowSkeletons count={3} />
              ) : queueQuery.isError ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  {t('Please refresh the page to try again.')}
                </p>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('Nothing assigned to this reviewer yet.')}
                </p>
              ) : (
                <ul className="flex flex-col rounded-lg border">
                  {assignments.map((item) => (
                    <AssignedRow
                      key={item.assignment.id}
                      item={item}
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
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Header3 className="font-light">{t('Add proposals')}</Header3>
                <div className="flex items-center gap-2">
                  {/* Import builds the selection like Select all does, so it
                      lives beside it. A frozen reviewer takes no new
                      proposals, so there is nothing to import into. */}
                  {importEnabled && canAssign ? (
                    <ImportPoolAction
                      processInstanceId={processInstanceId}
                      phaseId={phaseId}
                      reviewerProfileId={reviewerProfileId}
                      assignedProposalIds={assignedProposalIds}
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
                  {t('Search proposals')}
                </FieldLabel>
                <Input
                  id={searchId}
                  type="search"
                  value={search}
                  maxLength={PROPOSAL_SEARCH_MAX_LENGTH}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('Search by title')}
                />
              </Field>

              {/* Rendered unconditionally so the region exists before it has
                  anything to announce — a live region mounted with its text
                  already in place is never read out. */}
              <p aria-live="polite" className="sr-only">
                {pickQuery.isFetchingNextPage
                  ? t('Loading more proposals…')
                  : pickQuery.isSuccess
                    ? t(
                        '{count, plural, one {# proposal shown} other {# proposals shown}}',
                        { count: pickProposals.length },
                      )
                    : ''}
              </p>

              {pickQuery.isPending ? (
                <RowSkeletons count={5} />
              ) : pickQuery.isError ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  {t('Could not load the other proposals. Please try again.')}
                </p>
              ) : pickProposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {debouncedSearch
                    ? t('No proposals match "{query}".', {
                        query: debouncedSearch,
                      })
                    : t('No proposals in this phase yet.')}
                </p>
              ) : (
                <ul className="flex flex-col rounded-lg border">
                  {pickProposals.map((proposal) => {
                    const state = pickStateOf(
                      proposal,
                      assignedProposalIds,
                      reviewerProfileId,
                    );

                    return (
                      <PickRow
                        key={proposal.id}
                        proposal={proposal}
                        state={state}
                        canAssign={canAssign}
                        isChecked={
                          state === 'assigned' || toAssign.has(proposal.id)
                        }
                        onToggle={() =>
                          setToAssign((current) =>
                            toggled(current, proposal.id),
                          )
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
            ? t('{assign} to assign · {unassign} to unassign', {
                assign: assignIds.length,
                unassign: unassignIds.length,
              })
            : t('No changes yet')}
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
  isRemoved,
  onToggle,
}: {
  item: QueueAssignment;
  isRemoved: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const { titleText, displayCategories, authors } = useProposalCardData(
    item.assignment.proposal,
  );
  const status = item.review?.state ?? item.assignment.status;
  const canRemove = isRemovable(item);

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
                ? t('Keep {title} assigned', { title: titleText })
                : t('Remove {title}', { title: titleText })
            }
            onClick={onToggle}
          >
            {isRemoved ? t('Undo') : t('Remove')}
          </Button>
        ) : null}
      </span>
    </li>
  );
}

/** A phase proposal offered for assignment. */
function PickRow({
  proposal,
  state,
  canAssign,
  isChecked,
  onToggle,
}: {
  proposal: Proposal;
  state: PickState;
  canAssign: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const { titleText, displayCategories, authors } =
    useProposalCardData(proposal);
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
          {authors?.[0]?.name ? (
            <span className="truncate text-sm text-muted-foreground" dir="auto">
              {authors[0].name}
            </span>
          ) : null}
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-2">
          {state === 'own' ? (
            <Badge variant="outline">{t("Reviewer's own proposal")}</Badge>
          ) : null}
          {state === 'assigned' ? (
            <Badge variant="outline">{t('Already assigned')}</Badge>
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
  assignedProposalIds,
  onImport,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  assignedProposalIds: ReadonlySet<string>;
  onImport: (proposalIds: Array<string>) => void;
}) {
  const poolQuery = trpc.decision.listProposals.useInfiniteQuery(
    { processInstanceId, phaseId, limit: IMPORT_POOL_PAGE_LIMIT },
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

  const proposals = useMemo(
    () => collectAssignableProposals(poolQuery.data?.pages),
    [poolQuery.data?.pages],
  );

  const poolIds = useMemo(
    () => new Set(proposals.map((proposal) => proposal.id)),
    [proposals],
  );
  const assignableIds = useMemo(
    () =>
      new Set(
        proposals.flatMap((proposal) =>
          pickStateOf(proposal, assignedProposalIds, reviewerProfileId) ===
          'free'
            ? [proposal.id]
            : [],
        ),
      ),
    [proposals, assignedProposalIds, reviewerProfileId],
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
 * Drafts are dropped: `listProposals` surfaces the admin's own drafts inside
 * the phase window, but the assignment pool never contains one, so ticking it
 * would make `assignReviews` reject the whole save.
 */
function collectAssignableProposals(
  pages: Array<{ proposals: Proposal[] }> | undefined,
): Proposal[] {
  return (pages ?? [])
    .flatMap((page) => page.proposals)
    .filter((proposal) => proposal.status !== ProposalStatus.DRAFT);
}

/**
 * An existing assignment outranks "own proposal" — a stray self-assignment
 * must stay visible in the top section and, while pending, removable.
 */
function pickStateOf(
  proposal: Proposal,
  assignedProposalIds: ReadonlySet<string>,
  reviewerProfileId: string,
): PickState {
  if (assignedProposalIds.has(proposal.id)) {
    return 'assigned';
  }
  return proposal.submittedBy?.id === reviewerProfileId ? 'own' : 'free';
}

/** Only an untouched assignment can be withdrawn; a started review is a record. */
function isRemovable(item: QueueAssignment): boolean {
  return item.assignment.status === 'pending';
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
  t: ReturnType<typeof useTranslations>,
  createdCount: number,
  removedCount: number,
): string {
  if (createdCount > 0 && removedCount > 0) {
    return t(
      '{created, plural, one {# review assignment created} other {# review assignments created}} · {removed, plural, one {# proposal unassigned} other {# proposals unassigned}}',
      { created: createdCount, removed: removedCount },
    );
  }
  if (createdCount > 0) {
    return t(
      '{count, plural, one {# review assignment created} other {# review assignments created}}',
      { count: createdCount },
    );
  }
  return t(
    '{count, plural, one {# proposal unassigned} other {# proposals unassigned}}',
    { count: removedCount },
  );
}
