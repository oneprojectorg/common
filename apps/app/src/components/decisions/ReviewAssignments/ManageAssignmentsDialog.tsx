'use client';

import { trpc } from '@op/api/client';
import type {
  AdminAssignableProposal,
  AdminReviewAssignment,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useId, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';
import { AssignmentStatusBadge } from './AssignmentStatusBadge';
import type { ReviewerRow } from './buildReviewerRows';

/** How a proposal row behaves for this reviewer. */
type RowKind = 'own' | 'locked' | 'assigned' | 'free';

interface ProposalRow {
  proposal: AdminAssignableProposal;
  kind: RowKind;
  assignment: AdminReviewAssignment | null;
  /** The reviewer submitted this proposal — labelled whatever the kind is. */
  isOwn: boolean;
}

interface ManageAssignmentsDialogProps {
  processInstanceId: string;
  phaseId: string;
  reviewer: ReviewerRow;
  proposals: AdminAssignableProposal[];
}

/** A diff (assign / unassign) Save applies in one go; the visible diff IS the confirmation. */
export function ManageAssignmentsDialog({
  processInstanceId,
  phaseId,
  reviewer,
  proposals,
}: ManageAssignmentsDialogProps) {
  const t = useTranslations();
  const filterId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toAssign, setToAssign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [toUnassign, setToUnassign] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const name = reviewer.label;
  // A reviewer without the role gets a frozen queue: unassign pending only.
  const canAssign = reviewer.isEligible;

  const assignReviews = trpc.decision.assignReviews.useMutation();
  const removeAssignments = trpc.decision.removeReviewAssignments.useMutation();
  const isSaving = assignReviews.isPending || removeAssignments.isPending;

  const rows = useMemo(
    () => buildProposalRows(proposals, reviewer),
    [proposals, reviewer],
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
    reviewer.assignments.length -
    unassignAssignmentIds.length +
    assignIds.length;
  const hasChanges = assignIds.length > 0 || unassignAssignmentIds.length > 0;

  // Additive only: never bulk-unassigns.
  const visibleFreeIds = canAssign
    ? visibleRows.flatMap((row) =>
        row.kind === 'free' ? [row.proposal.id] : [],
      )
    : [];
  const allVisibleFreeSelected =
    visibleFreeIds.length > 0 && visibleFreeIds.every((id) => toAssign.has(id));

  const reset = () => {
    setQuery('');
    setToAssign(new Set());
    setToUnassign(new Set());
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
          reviewerProfileId: reviewer.profile.id,
          proposalIds: assignIds,
        });
        createdCount = result.createdCount;
      } catch (error) {
        logger.error('Failed to save review assignment changes', {
          error,
          context: 'ManageAssignmentsDialog',
          reviewerProfileId: reviewer.profile.id,
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
          reviewerProfileId: reviewer.profile.id,
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

    reset();
    setIsOpen(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          reset();
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        {t('Manage assignments')}
      </DialogTrigger>

      {/* 34rem × 38rem — the size the design's dialog was composed at. */}
      <DialogContent className="sm:max-h-152 sm:max-w-136 sm:overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {t("Manage {name}'s assignments", { name })}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Check a proposal to assign it; uncheck a pending one to unassign it. Started reviews can't be removed.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Not the filter's label — a moving count would rename the control. */}
            <p
              aria-live="polite"
              className="text-sm font-medium text-muted-foreground"
            >
              {t('Proposals ({count} assigned)', { count: assignedCount })}
            </p>
            <Button
              variant="ghost"
              onClick={toggleVisibleFree}
              disabled={visibleFreeIds.length === 0}
            >
              {allVisibleFreeSelected ? t('Clear') : t('Select all')}
            </Button>
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
    </Dialog>
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
            <AssignmentStatusBadge
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
  reviewer: ReviewerRow,
): ProposalRow[] {
  const assignmentByProposalId = new Map(
    reviewer.assignments.map((assignment) => [
      assignment.proposalId,
      assignment,
    ]),
  );

  return proposals.map((proposal) => {
    const assignment = assignmentByProposalId.get(proposal.id) ?? null;
    const isOwn = proposal.submittedByProfileId === reviewer.profile.id;

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
  assignment: AdminReviewAssignment | null,
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
