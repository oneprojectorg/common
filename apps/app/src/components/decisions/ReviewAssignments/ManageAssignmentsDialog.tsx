'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import type {
  AdminAssignableProposal,
  ReviewerAssignmentPool,
  ReviewerPoolAssignment,
} from '@op/common/client';
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
import type { ReactNode } from 'react';
import { useId, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';
import { ImportProposalIdsDialog } from './ImportProposalIdsDialog';

/** How a proposal row behaves for this reviewer. */
type RowKind = 'own' | 'locked' | 'assigned' | 'free';

interface ProposalRow {
  proposal: AdminAssignableProposal;
  kind: RowKind;
  assignment: ReviewerPoolAssignment | null;
  /** The reviewer submitted this proposal — labelled whatever the kind is. */
  isOwn: boolean;
}

interface ManageAssignmentsDialogContentProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  onSaved: () => void;
}

/** Fetches the pick list; mounted only while the dialog is open. */
export function ManageAssignmentsDialogContent({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  onSaved,
}: ManageAssignmentsDialogContentProps) {
  const [data] = trpc.decision.getReviewerAssignmentPool.useSuspenseQuery(
    { processInstanceId, phaseId, reviewerProfileId },
    // Refetch through the client link on mount — the SSR-seeded cache alone
    // never registers the `reviewAssignments` realtime channel.
    { refetchOnMount: 'always' },
  );

  return (
    <ManageAssignmentsForm
      processInstanceId={processInstanceId}
      phaseId={phaseId}
      pool={data}
      onSaved={onSaved}
    />
  );
}

/** A dialog-shaped shell for the loading, error and unknown-reviewer states. */
export function ManageAssignmentsDialogMessage({
  children,
}: {
  children: ReactNode;
}) {
  const t = useTranslations();

  return (
    <DialogContent className="sm:max-w-136">
      <DialogHeader>
        <DialogTitle>{t('Manage assignments')}</DialogTitle>
      </DialogHeader>
      <p className="px-6 py-4 text-sm text-muted-foreground">{children}</p>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t('Cancel')}
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

export function ManageAssignmentsDialogSkeleton() {
  const t = useTranslations();

  return (
    <DialogContent className="sm:max-h-152 sm:max-w-136 sm:overflow-hidden">
      <DialogHeader>
        <DialogTitle>{t('Manage assignments')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 py-4">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </DialogContent>
  );
}

interface ManageAssignmentsFormProps {
  processInstanceId: string;
  phaseId: string;
  pool: ReviewerAssignmentPool;
  onSaved: () => void;
}

/** A diff (assign / unassign) Save applies in one go; the visible diff IS the confirmation. */
function ManageAssignmentsForm({
  processInstanceId,
  phaseId,
  pool,
  onSaved,
}: ManageAssignmentsFormProps) {
  const { reviewer, proposals } = pool;
  const t = useTranslations();
  const filterId = useId();
  const importEnabled = useFeatureFlag('bulk_assign_import');

  const [query, setQuery] = useState('');
  const [toAssign, setToAssign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [toUnassign, setToUnassign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const name = reviewer.name ?? reviewer.slug ?? reviewer.id;
  // A reviewer without the role gets a frozen queue: unassign pending only.
  const canAssign = pool.isEligible;

  const assignReviews = trpc.decision.assignReviews.useMutation();
  const removeAssignments = trpc.decision.removeReviewAssignments.useMutation();
  const isSaving = assignReviews.isPending || removeAssignments.isPending;

  const rows = useMemo(
    () => buildProposalRows(proposals, pool),
    [proposals, pool],
  );

  const visibleRows = useMemo(() => filterRows(rows, query), [rows, query]);

  // Whole pool, not visibleRows — selections survive filter changes.
  const assignIds = canAssign
    ? rows.flatMap((row) =>
        row.kind === 'free' && toAssign.has(row.proposal.id)
          ? [row.proposal.id]
          : [],
      )
    : [];
  const unassignAssignmentIds = rows.flatMap((row) =>
    row.kind === 'assigned' && row.assignment && toUnassign.has(row.proposal.id)
      ? [row.assignment.id]
      : [],
  );

  const assignedCount =
    pool.assignments.length - unassignAssignmentIds.length + assignIds.length;
  const hasChanges = assignIds.length > 0 || unassignAssignmentIds.length > 0;

  // Additive only: never bulk-unassigns.
  const visibleFreeIds = canAssign
    ? visibleRows.flatMap((row) =>
        row.kind === 'free' ? [row.proposal.id] : [],
      )
    : [];
  const allVisibleFreeSelected =
    visibleFreeIds.length > 0 && visibleFreeIds.every((id) => toAssign.has(id));

  // Sets, not lists: the spreadsheet import looks IDs up by membership.
  const poolIds = useMemo(
    () => new Set(proposals.map((proposal) => proposal.id)),
    [proposals],
  );
  const importableIds = useMemo(
    () =>
      new Set(
        rows.flatMap((row) => (row.kind === 'free' ? [row.proposal.id] : [])),
      ),
    [rows],
  );

  // Additive, like every other selection gesture here: an import never drops
  // rows the admin ticked by hand.
  const importProposals = (proposalIds: Array<string>) => {
    setToAssign((current) => new Set([...current, ...proposalIds]));
  };

  const toggleRow = (row: ProposalRow) => {
    const proposalId = row.proposal.id;

    if (row.kind === 'free') {
      if (canAssign) {
        setToAssign((current) => toggled(current, proposalId));
      }
      return;
    }
    if (row.kind === 'assigned') {
      setToUnassign((current) => toggled(current, proposalId));
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

  // The `reviewAssignments` channel refetches the list; nothing invalidates.
  // The two halves are separate mutations, so each reports its own failure —
  // one "could not save" toast after the assign half committed would lie.
  const save = async () => {
    let createdCount = 0;

    if (assignIds.length > 0) {
      try {
        const result = await assignReviews.mutateAsync({
          processInstanceId,
          phaseId,
          reviewerProfileId: reviewer.id,
          proposalIds: assignIds,
        });
        createdCount = result.createdCount;
      } catch (error) {
        logger.error('Failed to save review assignment changes', {
          error,
          context: 'ManageAssignmentsDialog',
          reviewerProfileId: reviewer.id,
        });
        // Nothing committed yet — every selection is still worth retrying.
        toast.error(t('Could not save the changes. Please try again.'));
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
          reviewerProfileId: reviewer.id,
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

  return (
    // 34rem × 38rem — the size the design's dialog was composed at.
    <DialogContent className="sm:max-h-152 sm:max-w-136 sm:overflow-hidden">
      <DialogHeader>
        <DialogTitle>{t("Manage {name}'s assignments", { name })}</DialogTitle>
        <DialogDescription>
          {t(
            "Check a proposal to assign it; uncheck a pending one to unassign it. Started reviews can't be removed.",
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Not the filter's label — a moving count would rename the control. */}
          <Header3 aria-live="polite" className="font-light">
            {t('Proposals ({count} assigned)', { count: assignedCount })}
          </Header3>
          <div className="flex items-center gap-2">
            {/* Import builds the selection like Select all does, so it lives
                  beside it. Stacked on this dialog, which stays mounted
                  underneath. A frozen reviewer takes no new proposals, so
                  there is nothing to import into. */}
            {importEnabled && canAssign ? (
              <ImportProposalIdsDialog
                poolIds={poolIds}
                assignableIds={importableIds}
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

        {canAssign ? null : (
          <p className="text-sm text-muted-foreground">
            {t(
              'This reviewer no longer has the reviewer role, so they cannot take new proposals.',
            )}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor={filterId} className="sr-only">
            {t('Filter proposals')}
          </FieldLabel>
          <Input
            id={filterId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Filter by title or category…')}
          />
        </Field>

        <p aria-live="polite" className="sr-only">
          {t(
            '{count, plural, one {# proposal shown} other {# proposals shown}}',
            {
              count: visibleRows.length,
            },
          )}
        </p>

        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border">
          {visibleRows.map((row) => (
            <ProposalCheckRow
              key={row.proposal.id}
              row={row}
              canAssign={canAssign}
              isChecked={isRowChecked(row, toAssign, toUnassign)}
              onToggle={() => toggleRow(row)}
            />
          ))}
          {visibleRows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {proposals.length === 0
                ? t('No proposals in this phase yet.')
                : t('No proposals match "{query}".', { query: query.trim() })}
            </li>
          ) : null}
        </ul>
      </div>

      <DialogFooter className="sm:justify-between">
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground sm:self-center"
        >
          {hasChanges
            ? t('{assign} to assign · {unassign} to unassign', {
                assign: assignIds.length,
                unassign: unassignAssignmentIds.length,
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
    </DialogContent>
  );
}

function ProposalCheckRow({
  row,
  canAssign,
  isChecked,
  onToggle,
}: {
  row: ProposalRow;
  canAssign: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const { proposal, kind, assignment, isOwn } = row;
  const authorName = proposal.author
    ? (proposal.author.name ?? proposal.author.slug)
    : null;
  // `assigned` stays checkable even when frozen, so the queue can be cleaned.
  const isDisabled =
    kind === 'own' || kind === 'locked' || (kind === 'free' && !canAssign);

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
            {proposal.title ?? t('Untitled Proposal')}
          </span>
          {authorName ? (
            <span className="truncate text-sm text-muted-foreground" dir="auto">
              {authorName}
            </span>
          ) : null}
        </span>
        <span className="ms-auto flex shrink-0 items-center gap-2">
          {isOwn ? (
            <Badge variant="outline">{t("Reviewer's own proposal")}</Badge>
          ) : null}
          {kind === 'locked' && assignment ? (
            <ReviewStatusBadge
              status={assignment.reviewState ?? assignment.status}
            />
          ) : null}
          {(kind === 'free' || kind === 'assigned') &&
          proposal.categories.length > 0 ? (
            <SelectionCategoryChips
              labels={proposal.categories.map((category) => category.label)}
            />
          ) : null}
        </span>
      </Label>
    </li>
  );
}

function buildProposalRows(
  proposals: AdminAssignableProposal[],
  pool: ReviewerAssignmentPool,
): ProposalRow[] {
  const assignmentByProposalId = new Map(
    pool.assignments.map((assignment) => [assignment.proposalId, assignment]),
  );

  return proposals.map((proposal) => {
    const assignment = assignmentByProposalId.get(proposal.id) ?? null;
    const isOwn = proposal.submittedByProfileId === pool.reviewer.id;

    return {
      proposal,
      assignment,
      isOwn,
      kind: resolveRowKind(assignment, isOwn),
    };
  });
}

// An existing assignment outranks "own proposal" — a stray self-assignment
// must stay visible and, while pending, removable.
function resolveRowKind(
  assignment: ReviewerPoolAssignment | null,
  isOwn: boolean,
): RowKind {
  if (assignment) {
    return assignment.status === 'pending' ? 'assigned' : 'locked';
  }
  return isOwn ? 'own' : 'free';
}

function filterRows(rows: ProposalRow[], query: string): ProposalRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return rows;
  }

  return rows.filter(
    (row) =>
      (row.proposal.title ?? '').toLowerCase().includes(needle) ||
      row.proposal.categories.some((category) =>
        category.label.toLowerCase().includes(needle),
      ),
  );
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
      return !toUnassign.has(row.proposal.id);
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
