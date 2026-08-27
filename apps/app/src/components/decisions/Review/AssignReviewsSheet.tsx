'use client';

import { trpc } from '@op/api/client';
import type {
  AdminAssignableProposal,
  AdminDecisionReviewer,
  AdminReviewAssignment,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import { useDirection } from '@op/sense/Direction';
import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Progress } from '@op/sense/Progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@op/sense/Sheet';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useFormatter } from 'next-intl';
import { useId, useMemo, useRef, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';

/** A reviewer row: the server rollup, or an eligible reviewer with no work yet. */
export type ReviewerRow = AdminDecisionReviewer & {
  /** From the eligible list; tells two same-named reviewers apart. */
  email: string | null;
  /**
   * False for a reviewer with historical assignments who has lost the REVIEW
   * capability: their assignments stay visible, but they can't take new ones.
   */
  isEligible: boolean;
};

/**
 * Per-reviewer assignment desk, opened from a reviewer row. One sheet shows
 * both halves of the job: what the reviewer already has (with unassign on
 * pending rows) and what can still be assigned to them. Assigning keeps the
 * sheet open so several batches can be built without re-finding the reviewer.
 * Mount keyed by reviewer id so switching reviewers resets filter + selection.
 */
export function AssignReviewsSheet({
  processInstanceId,
  phaseId,
  reviewer,
  proposals,
  reviewerIdsByProposalId,
  onClose,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewer: ReviewerRow;
  /** Every assignable proposal in the phase. */
  proposals: AdminAssignableProposal[];
  /** Reviewers already assigned per proposal — the coverage hint on each row. */
  reviewerIdsByProposalId: ReadonlyMap<string, string[]>;
  onClose: () => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const filterId = useId();
  // Sheet's side is physical, so it has to be mirrored to stay at inline-end.
  const isRtl = useDirection() === 'rtl';
  const assignedHeadingRef = useRef<HTMLHeadingElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const name = reviewerLabel(reviewer.profile);

  const assignReviews = trpc.decision.assignReviews.useMutation({
    onSuccess: ({ createdCount }) => {
      toast.success(
        t(
          '{count, plural, one {# review assignment created} other {# review assignments created}}',
          { count: createdCount },
        ),
      );
      setSelectedIds(new Set());
      utils.decision.listPhaseReviewAssignments.invalidate({
        processInstanceId,
        phaseId,
      });
      // The Assign button just disabled itself while focused; park focus on
      // the assigned heading so keyboard users stay inside the sheet.
      assignedHeadingRef.current?.focus();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const assignedProposalIds = useMemo(
    () =>
      new Set(reviewer.assignments.map((assignment) => assignment.proposalId)),
    [reviewer.assignments],
  );

  // Assigned proposals live in the section above, so candidates exclude them
  // outright; `isOwnProposal` is what makes a listed row uncheckable.
  const rows = useMemo(
    () =>
      proposals
        .filter((proposal) => !assignedProposalIds.has(proposal.id))
        .map((proposal) => ({
          proposal,
          reviewerCount: (reviewerIdsByProposalId.get(proposal.id) ?? [])
            .length,
          isOwnProposal: proposal.submittedByProfileId === reviewer.profile.id,
        })),
    [
      proposals,
      assignedProposalIds,
      reviewerIdsByProposalId,
      reviewer.profile.id,
    ],
  );

  const visibleRows = useMemo(() => {
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
  }, [rows, query]);

  // Submitted set spans the whole pool, not just what the filter shows, so
  // "filter → select all → filter again → select all → assign" accumulates.
  // It also drops ids that a refetch moved into the assigned section.
  const selectedAssignableIds = rows
    .filter((row) => !row.isOwnProposal && selectedIds.has(row.proposal.id))
    .map((row) => row.proposal.id);

  const selectableVisibleIds = visibleRows
    .filter((row) => !row.isOwnProposal)
    .map((row) => row.proposal.id);

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.has(id));

  const toggleProposal = (proposalId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(proposalId)) {
        next.delete(proposalId);
      } else {
        next.add(proposalId);
      }
      return next;
    });
  };

  // Scoped to the current filter: that is the bulk gesture this desk is for.
  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of selectableVisibleIds) {
        if (allVisibleSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const canSubmit =
    selectedAssignableIds.length > 0 && !assignReviews.isPending;

  const progressPercent =
    reviewer.assignedCount > 0
      ? (reviewer.submittedCount / reviewer.assignedCount) * 100
      : 0;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {/* The width override repeats the component's data-side variant chain so
          `cn` replaces the default `sm:max-w-sm` instead of losing to its
          higher attribute-selector specificity. */}
      <SheetContent
        side={isRtl ? 'left' : 'right'}
        className="gap-0 p-0 data-[side=left]:sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="gap-2 border-b">
          <div className="flex items-center gap-3">
            <ProfileAvatar name={name} alt={name} />
            <div className="flex min-w-0 flex-col">
              <SheetTitle>{name}</SheetTitle>
              {reviewer.email ? (
                <SheetDescription className="truncate text-sm">
                  {reviewer.email}
                </SheetDescription>
              ) : null}
            </div>
          </div>
          {reviewer.assignedCount > 0 ? (
            <span className="flex items-center gap-2.5">
              <Progress
                value={progressPercent}
                className="w-24"
                aria-label={t('Review progress')}
              />
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                {t('{submitted} of {assigned} submitted', {
                  submitted: reviewer.submittedCount,
                  assigned: reviewer.assignedCount,
                })}
              </span>
            </span>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('No assignments in this phase yet.')}
            </p>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          <section className="flex flex-col gap-2">
            <h3
              ref={assignedHeadingRef}
              tabIndex={-1}
              className="text-sm font-medium text-muted-foreground outline-none"
            >
              {t('Assigned ({count})', { count: reviewer.assignments.length })}
            </h3>
            {reviewer.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {reviewer.isEligible
                  ? t("Pick proposals below to build this reviewer's queue.")
                  : t('No assignments in this phase yet.')}
              </p>
            ) : (
              <ul className="flex flex-col rounded-lg border">
                {reviewer.assignments.map((assignment) => (
                  <AssignedRow
                    key={assignment.id}
                    processInstanceId={processInstanceId}
                    phaseId={phaseId}
                    assignment={assignment}
                    reviewerName={name}
                    onUnassigned={() => assignedHeadingRef.current?.focus()}
                  />
                ))}
              </ul>
            )}
          </section>

          {reviewer.isEligible ? (
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel
                  htmlFor={filterId}
                  className="text-sm font-medium text-muted-foreground"
                >
                  {t('Assign more ({count} selected)', {
                    count: selectedAssignableIds.length,
                  })}
                </FieldLabel>
                <Button
                  variant="ghost"
                  onClick={toggleAllVisible}
                  disabled={selectableVisibleIds.length === 0}
                >
                  {allVisibleSelected ? t('Clear') : t('Select all')}
                </Button>
              </div>

              <Input
                id={filterId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('Filter by title or category…')}
              />

              {/* The live region is this count, not the list — announcing the
                  list re-read every row on each filter keystroke. */}
              <p aria-live="polite" className="sr-only">
                {t(
                  '{count, plural, one {# proposal shown} other {# proposals shown}}',
                  { count: visibleRows.length },
                )}
              </p>

              <ul className="flex flex-col rounded-lg border">
                {visibleRows.map(
                  ({ proposal, reviewerCount, isOwnProposal }) => {
                    const authorName = proposal.author
                      ? (proposal.author.name ?? proposal.author.slug)
                      : null;

                    return (
                      <li
                        key={proposal.id}
                        className="border-b last:border-b-0"
                      >
                        <Label
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 font-normal',
                            isOwnProposal
                              ? 'text-muted-foreground'
                              : 'hover:bg-muted/50',
                          )}
                        >
                          <Checkbox
                            checked={
                              !isOwnProposal && selectedIds.has(proposal.id)
                            }
                            disabled={isOwnProposal}
                            onCheckedChange={() => toggleProposal(proposal.id)}
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">
                              {proposal.title ?? t('Untitled Proposal')}
                            </span>
                            {authorName || reviewerCount > 0 ? (
                              <span className="flex min-w-0 items-baseline gap-2 text-sm text-muted-foreground">
                                {authorName ? (
                                  <span className="truncate">{authorName}</span>
                                ) : null}
                                {reviewerCount > 0 ? (
                                  <span className="shrink-0">
                                    {t(
                                      '{count, plural, one {# reviewer} other {# reviewers}}',
                                      { count: reviewerCount },
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </span>
                          {proposal.categories.length > 0 ? (
                            <span className="ms-auto flex shrink-0">
                              <SelectionCategoryChips
                                labels={proposal.categories.map(
                                  (category) => category.label,
                                )}
                              />
                            </span>
                          ) : null}
                          {isOwnProposal ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0',
                                proposal.categories.length === 0 && 'ms-auto',
                              )}
                            >
                              {t("Reviewer's own proposal")}
                            </Badge>
                          ) : null}
                        </Label>
                      </li>
                    );
                  },
                )}
                {visibleRows.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    {proposals.length === 0
                      ? t('No proposals in this phase yet.')
                      : rows.length === 0
                        ? t(
                            'Every proposal is already assigned to this reviewer.',
                          )
                        : t('No proposals match "{query}".', {
                            query: query.trim(),
                          })}
                  </li>
                ) : null}
              </ul>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(
                'This reviewer no longer has the reviewer role, so they cannot take new proposals.',
              )}
            </p>
          )}
        </div>

        <SheetFooter className="flex-row justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('Done')}
          </Button>
          {reviewer.isEligible ? (
            <Button
              disabled={!canSubmit}
              onClick={() =>
                assignReviews.mutate({
                  processInstanceId,
                  phaseId,
                  reviewerProfileId: reviewer.profile.id,
                  proposalIds: selectedAssignableIds,
                })
              }
            >
              {assignReviews.isPending
                ? t('Assigning…')
                : t(
                    '{count, plural, one {Assign # proposal} other {Assign # proposals}}',
                    { count: selectedAssignableIds.length },
                  )}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function reviewerLabel(profile: {
  id: string;
  name: string | null;
  slug: string | null;
}): string {
  return profile.name ?? profile.slug ?? profile.id;
}

/** One assigned proposal: title/author, status, and unassign while pending. */
function AssignedRow({
  processInstanceId,
  phaseId,
  assignment,
  reviewerName,
  onUnassigned,
}: {
  processInstanceId: string;
  phaseId: string;
  assignment: AdminReviewAssignment;
  reviewerName: string;
  /** The ✕ that had focus is about to disappear; the caller re-parks focus. */
  onUnassigned: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const statusLabel = useStatusLabels();

  const state = assignment.reviewState ?? assignment.status;
  const authorName = assignment.author?.name ?? assignment.author?.slug ?? null;
  const title = assignment.proposalTitle ?? t('Untitled Proposal');

  return (
    <li className="flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base text-foreground">
          <bdi>{title}</bdi>
        </span>
        {authorName ? (
          <span className="truncate text-sm text-muted-foreground">
            <bdi>{authorName}</bdi>
          </span>
        ) : null}
      </span>
      <span className="ms-auto flex shrink-0 items-center gap-2">
        <Badge variant={statusBadgeVariant(assignment.reviewState)}>
          {statusLabel[state] ?? state}
        </Badge>
        {assignment.reviewState === 'submitted' && assignment.submittedAt ? (
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {format.dateTime(new Date(assignment.submittedAt), {
              dateStyle: 'medium',
            })}
          </span>
        ) : null}
        {assignment.status === 'pending' ? (
          <UnassignButton
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            assignment={assignment}
            proposalTitle={title}
            reviewerName={reviewerName}
            onUnassigned={onUnassigned}
          />
        ) : null}
      </span>
    </li>
  );
}

/**
 * Unassign with confirmation. The confirm is an `AlertDialog` rather than an
 * inline action because unassigning removes another person's queued work.
 */
function UnassignButton({
  processInstanceId,
  phaseId,
  assignment,
  proposalTitle,
  reviewerName,
  onUnassigned,
}: {
  processInstanceId: string;
  phaseId: string;
  assignment: AdminReviewAssignment;
  proposalTitle: string;
  reviewerName: string;
  onUnassigned: () => void;
}) {
  const t = useTranslations();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // The `reviewAssignments` channel refetches the list; nothing invalidates.
  const removeAssignments = trpc.decision.removeReviewAssignments.useMutation({
    onSuccess: ({ skippedIds }) => {
      // Skipped = no longer pending, for a reason the API doesn't report.
      if (skippedIds.includes(assignment.id)) {
        toast.error(t('Could not unassign — the assignment has changed.'));
      } else {
        toast.success(
          t('Proposal unassigned from {name}', { name: reviewerName }),
        );
        onUnassigned();
      }
      setIsConfirmOpen(false);
    },
    onError: (error) => {
      logger.error('Failed to unassign a review assignment', {
        error,
        context: 'AssignReviewsSheet',
        assignmentId: assignment.id,
      });
      toast.error(t('Could not unassign the proposal. Please try again.'));
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('Unassign "{title}" from {name}', {
          title: proposalTitle,
          name: reviewerName,
        })}
        onClick={() => setIsConfirmOpen(true)}
      >
        <LuX />
      </Button>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Unassign proposal?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                '{name} will no longer be asked to review this proposal. You can assign it to them again later.',
                { name: reviewerName },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeAssignments.isPending}
              onClick={() =>
                removeAssignments.mutate({
                  processInstanceId,
                  phaseId,
                  assignmentIds: [assignment.id],
                })
              }
            >
              {removeAssignments.isPending ? t('Unassigning…') : t('Unassign')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function statusBadgeVariant(reviewState: string | null) {
  if (reviewState === 'submitted') {
    return 'default' as const;
  }
  if (reviewState === 'draft') {
    return 'warning' as const;
  }
  return 'outline' as const;
}

/** Translated labels for assignment statuses and review states. */
function useStatusLabels(): Record<string, string> {
  const t = useTranslations();

  return {
    pending: t('Pending'),
    in_progress: t('In progress'),
    awaiting_author_revision: t('Awaiting revision'),
    ready_for_re_review: t('Ready for re-review'),
    completed: t('Completed'),
    draft: t('Draft'),
    submitted: t('Submitted'),
  };
}
