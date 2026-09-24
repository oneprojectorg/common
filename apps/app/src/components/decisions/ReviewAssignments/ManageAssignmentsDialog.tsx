'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import {
  type AssignableProposal,
  PROPOSAL_SEARCH_MAX_LENGTH,
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
import { useCallback, useId, useMemo, useState } from 'react';

import type { TranslateFn } from '@/lib/i18n';
import { useTranslations } from '@/lib/i18n';

import { useCardTranslation } from '../ProposalTranslationContext';
import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';
import { ImportProposalIdsDialog } from './ImportProposalIdsDialog';
import { type RowKind, rowKindOf } from './assignableRowKind';

interface ProposalRow {
  proposal: AssignableProposal;
  kind: RowKind;
}

interface ManageAssignmentsDialogContentProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  onSaved: () => void;
}

interface ManageAssignmentsFormProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  reviewerName: string;
  isEligible: boolean;
  canModifyAssignments: boolean;
  assignedTotal: number;
  onSaved: () => void;
}

const PICK_PAGE_LIMIT = 24;

const SEARCH_DEBOUNCE_MS = 300;

const EMPTY_PICK_ROWS: AssignableProposal[] = [];

export function ManageAssignmentsDialogContent(
  props: ManageAssignmentsDialogContentProps,
) {
  return (
    <DialogContent className="sm:max-h-152 sm:max-w-136 sm:overflow-hidden">
      {/* Hooks stay in this child: the portal defers it to open, and unmount resets the selection. */}
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

  const queueQuery = trpc.decision.listReviewerAssignments.useInfiniteQuery(
    { processInstanceId, phaseId, reviewerProfileId },
    {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      refetchOnMount: false,
    },
  );
  const queue = queueQuery.data?.pages[0];

  if (queueQuery.isPending) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {t('decisions.review.manageAssignmentsAction')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 py-4">
          <Skeleton className="h-6 w-64" aria-hidden />
          <Skeleton className="h-9 w-full" aria-hidden />
          <Skeleton className="h-64 w-full" aria-hidden />
        </div>
      </>
    );
  }

  if (!queue) {
    return (
      <DialogHeader>
        <DialogTitle>{t('decisions.review.loadAssignmentsError')}</DialogTitle>
        <DialogDescription>
          {t('decisions.proposals.refreshPageHint')}
        </DialogDescription>
      </DialogHeader>
    );
  }

  const { reviewer } = queue;

  if (!reviewer) {
    return (
      <DialogHeader>
        <DialogTitle>
          {t('decisions.review.manageAssignmentsAction')}
        </DialogTitle>
        <DialogDescription>
          {t('decisions.review.reviewerNotInPhase')}
        </DialogDescription>
      </DialogHeader>
    );
  }

  return (
    <ManageAssignmentsForm
      processInstanceId={processInstanceId}
      phaseId={phaseId}
      reviewerProfileId={reviewerProfileId}
      reviewerName={reviewer.name ?? reviewer.slug ?? reviewer.id}
      isEligible={queue.isEligible}
      canModifyAssignments={queue.canModifyAssignments}
      assignedTotal={queue.total}
      onSaved={onSaved}
    />
  );
}

/** A diff (assign / unassign) Save applies in one go; the visible diff IS the confirmation. */
function ManageAssignmentsForm({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  reviewerName,
  isEligible,
  canModifyAssignments,
  assignedTotal,
  onSaved,
}: ManageAssignmentsFormProps) {
  const t = useTranslations();
  const filterId = useId();
  const importEnabled = useFeatureFlag('bulk_assign_import');

  // State, not a ref: the sentinel's observer root must re-render once attached.
  const [scrollRoot, setScrollRoot] = useState<HTMLUListElement | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const [toAssign, setToAssign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  // Assignment ids, so a removal survives its row leaving the loaded pages.
  const [toUnassign, setToUnassign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  // A reviewer without the role gets a frozen queue: unassign pending only.
  const canAssign = isEligible && canModifyAssignments;

  const pickQuery = trpc.decision.listAssignableProposals.useInfiniteQuery(
    {
      processInstanceId,
      phaseId,
      reviewerProfileId,
      limit: PICK_PAGE_LIMIT,
      ...(debouncedQuery ? { search: debouncedQuery } : {}),
    },
    {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      staleTime: 30 * 1000,
      placeholderData: (previous) => previous,
    },
  );

  const rows = useMemo(
    () =>
      (
        pickQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_PICK_ROWS
      ).map(toProposalRow),
    [pickQuery.data?.pages],
  );

  const { fetchNextPage } = pickQuery;
  const loadNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);
  const { ref: sentinelRef, shouldShowTrigger } =
    useInfiniteScroll<HTMLLIElement>(loadNextPage, {
      hasNextPage: pickQuery.hasNextPage,
      isFetchingNextPage: pickQuery.isFetchingNextPage,
      // The list's scroller, not the viewport: the dialog clips a viewport root.
      root: scrollRoot,
    });

  const assignReviews = trpc.decision.assignReviews.useMutation();
  const removeAssignments = trpc.decision.removeReviewAssignments.useMutation();
  const isSaving = assignReviews.isPending || removeAssignments.isPending;

  const assignedProposalIds = new Set(
    rows.flatMap((row) => (row.proposal.assignment ? [row.proposal.id] : [])),
  );
  const lockedAssignmentIds = new Set(
    rows.flatMap((row) =>
      row.kind === 'locked' && row.proposal.assignment
        ? [row.proposal.assignment.id]
        : [],
    ),
  );

  const assignIds = canAssign
    ? [...toAssign].filter((id) => !assignedProposalIds.has(id))
    : [];
  const unassignAssignmentIds = canModifyAssignments
    ? [...toUnassign].filter((id) => !lockedAssignmentIds.has(id))
    : [];

  const assignedCount =
    assignedTotal - unassignAssignmentIds.length + assignIds.length;
  const hasChanges = assignIds.length > 0 || unassignAssignmentIds.length > 0;

  // Additive only: never bulk-unassigns.
  const visibleFreeIds = canAssign
    ? rows.flatMap((row) => (row.kind === 'free' ? [row.proposal.id] : []))
    : [];
  const allVisibleFreeSelected =
    visibleFreeIds.length > 0 && visibleFreeIds.every((id) => toAssign.has(id));

  // Additive, like every other selection gesture here: an import never drops
  // rows the admin ticked by hand.
  const importProposals = (proposalIds: Array<string>) => {
    setToAssign((current) => new Set([...current, ...proposalIds]));
  };

  const toggleRow = (row: ProposalRow) => {
    const { assignment } = row.proposal;

    if (row.kind === 'free') {
      if (canAssign) {
        setToAssign((current) => toggled(current, row.proposal.id));
      }
      return;
    }
    if (row.kind === 'assigned' && assignment && canModifyAssignments) {
      setToUnassign((current) => toggled(current, assignment.id));
    }
  };

  const toggleVisibleFree = () => {
    setToAssign((current) => {
      const next = new Set(current);
      for (const id of visibleFreeIds) {
        if (allVisibleFreeSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

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
        toast.error(t('decisions.review.saveChangesError'));
        return;
      }
    }

    let removedCount = 0;
    let skippedIds: string[] = [];

    if (unassignAssignmentIds.length > 0) {
      try {
        const result = await removeAssignments.mutateAsync({
          processInstanceId,
          phaseId,
          assignmentIds: unassignAssignmentIds,
        });
        skippedIds = result.skippedIds;
        removedCount = unassignAssignmentIds.length - skippedIds.length;
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
      toast.info(t('decisions.review.noChangesNeeded'));
    }

    if (skippedIds.length > 0) {
      toast.error(t('decisions.review.unassignConflictError'));
    }

    onSaved();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t('decisions.review.manageReviewerAssignmentsTitle', {
            name: reviewerName,
          })}
        </DialogTitle>
        <DialogDescription>
          {t('decisions.review.manageAssignmentsHint')}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Not the filter's label — a moving count would rename the control. */}
          <Header3 aria-live="polite" className="font-light">
            {t('decisions.review.proposalsAssignedHeading', {
              count: assignedCount,
            })}
          </Header3>
          <div className="flex items-center gap-2">
            {/* Import builds the selection like Select all does, so it sits beside it. */}
            {importEnabled && canAssign ? (
              <ImportProposalIdsDialog
                processInstanceId={processInstanceId}
                phaseId={phaseId}
                reviewerProfileId={reviewerProfileId}
                onImport={importProposals}
              />
            ) : null}
            <Button
              variant="link"
              onClick={toggleVisibleFree}
              disabled={visibleFreeIds.length === 0}
            >
              {allVisibleFreeSelected ? t('Clear') : t('Select all')}
            </Button>
          </div>
        </div>

        {!canModifyAssignments ? (
          <p className="text-sm text-muted-foreground">
            {t('decisions.review.phaseEndedAssignmentsLockedHint')}
          </p>
        ) : !canAssign ? (
          <p className="text-sm text-muted-foreground">
            {t('decisions.review.reviewerRoleRemovedHint')}
          </p>
        ) : null}

        <Field>
          <FieldLabel htmlFor={filterId} className="sr-only">
            {t('decisions.proposals.filterProposalsLabel')}
          </FieldLabel>
          <Input
            id={filterId}
            type="search"
            value={query}
            maxLength={PROPOSAL_SEARCH_MAX_LENGTH}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('decisions.review.searchByTitlePlaceholder')}
          />
        </Field>

        {/* Mounted empty first: a live region that arrives with its text is never read. */}
        <p aria-live="polite" className="sr-only">
          {pickQuery.isFetchingNextPage
            ? t('decisions.review.loadingMoreProposals')
            : pickQuery.isSuccess
              ? t('decisions.review.proposalsShownCount', {
                  count: rows.length,
                })
              : ''}
        </p>

        {pickQuery.isPending ? (
          <Skeleton className="h-64 w-full" aria-hidden />
        ) : pickQuery.isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {t('decisions.proposals.mergeCandidatesLoadError')}
          </p>
        ) : (
          // The sentinel's observer root, so it must be the element that scrolls.
          <ul
            ref={setScrollRoot}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border"
          >
            {rows.map((row) => (
              <ProposalCheckRow
                key={row.proposal.id}
                row={row}
                canAssign={canAssign}
                canModifyAssignments={canModifyAssignments}
                isChecked={isRowChecked(row, toAssign, toUnassign)}
                onToggle={() => toggleRow(row)}
              />
            ))}
            {rows.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {debouncedQuery
                  ? t('decisions.review.noProposalsMatchQuery', {
                      query: debouncedQuery,
                    })
                  : t('decisions.review.noProposalsInPhase')}
              </li>
            ) : null}
            {/* Padded: a zero-height target never meets the intersection threshold. */}
            {shouldShowTrigger ? (
              <li ref={sentinelRef} aria-hidden className="px-3 py-2">
                {pickQuery.isFetchingNextPage ? (
                  <Skeleton className="h-10 w-full" />
                ) : null}
              </li>
            ) : null}
          </ul>
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
                unassign: unassignAssignmentIds.length,
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

function ProposalCheckRow({
  row,
  canAssign,
  canModifyAssignments,
  isChecked,
  onToggle,
}: {
  row: ProposalRow;
  canAssign: boolean;
  canModifyAssignments: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const { proposal, kind } = row;
  const { titleText, displayCategories } = useAssignableRowData(proposal);
  // `assigned` stays checkable even when frozen, so the queue can be cleaned.
  const isDisabled =
    kind === 'own' ||
    kind === 'locked' ||
    (kind === 'free' && !canAssign) ||
    (kind === 'assigned' && !canModifyAssignments);

  return (
    <li className="border-b last:border-b-0">
      <Label
        className={cn(
          'flex items-center gap-2 px-3 py-2 font-normal',
          isDisabled && kind !== 'locked'
            ? 'text-muted-foreground'
            : 'hover:bg-muted/50',
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
          {proposal.authorName ? (
            <span className="truncate text-sm text-muted-foreground" dir="auto">
              {proposal.authorName}
            </span>
          ) : null}
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-2">
          {proposal.isOwn ? (
            <Badge variant="outline">
              {t('decisions.review.reviewerOwnProposal')}
            </Badge>
          ) : null}
          {kind === 'locked' && proposal.assignment ? (
            <ReviewStatusBadge
              status={
                proposal.assignment.reviewState ?? proposal.assignment.status
              }
            />
          ) : null}
          {(kind === 'free' || kind === 'assigned') &&
          displayCategories.length > 0 ? (
            <SelectionCategoryChips labels={displayCategories} />
          ) : null}
        </span>
      </Label>
    </li>
  );
}

/** Titles prefer `profileName`: `proposalData.title` is a creation-time snapshot. */
function useAssignableRowData(row: AssignableProposal) {
  const t = useTranslations();
  const cardTranslation = useCardTranslation(row.profileId);

  return {
    titleText:
      cardTranslation?.title ??
      (row.profileName ||
        row.proposalData.title ||
        t('decisions.proposals.untitledProposal')),
    displayCategories: cardTranslation?.category
      ? cardTranslation.category
      : normalizeProposalCategories(row.proposalData.category),
  };
}

function toProposalRow(proposal: AssignableProposal): ProposalRow {
  return { proposal, kind: rowKindOf(proposal) };
}

function isRowChecked(
  row: ProposalRow,
  toAssign: ReadonlySet<string>,
  toUnassign: ReadonlySet<string>,
): boolean {
  switch (row.kind) {
    case 'own':
      return false;
    case 'locked':
      return true;
    case 'assigned':
      return row.proposal.assignment
        ? !toUnassign.has(row.proposal.assignment.id)
        : true;
    case 'free':
      return toAssign.has(row.proposal.id);
  }
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
