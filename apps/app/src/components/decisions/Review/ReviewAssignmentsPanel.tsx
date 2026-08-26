'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type {
  AdminAssignableProposal,
  AdminDecisionReviewer,
  AdminEligibleReviewer,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Progress } from '@op/sense/Progress';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { toast } from '@op/sense/Toast';
import { useFormatter } from 'next-intl';
import { Fragment, Suspense, useMemo, useState } from 'react';
import {
  LuChevronDown,
  LuChevronRight,
  LuEllipsis,
  LuUserPlus,
  LuUsers,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';
import { AssignProposalsDialog } from './AssignProposalsDialog';

/** A reviewer row: the server rollup, or an eligible reviewer with no work yet. */
type ReviewerRow = AdminDecisionReviewer & {
  /** From the eligible list; tells two same-named reviewers apart. */
  email: string | null;
  /**
   * False for a reviewer with historical assignments who has lost the REVIEW
   * capability: their row stays, but the assign affordance is disabled.
   */
  isEligible: boolean;
};

/** Which reviewer the assign dialog opens pre-scoped to, `null` for "pick one". */
type AssignTarget = { reviewerProfileId: string | null };

export function ReviewAssignmentsPanel({
  processInstanceId,
  phaseId,
  phaseName,
}: {
  processInstanceId: string;
  phaseId: string;
  /** Display name of the phase, shown in the summary line. */
  phaseName: string;
}) {
  const t = useTranslations();

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LuUsers className="size-6" />
              </EmptyMedia>
              <EmptyTitle>
                {t("We couldn't load review assignments")}
              </EmptyTitle>
              <EmptyDescription>
                {t('Please refresh the page to try again.')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ),
      }}
    >
      <Suspense fallback={<ReviewAssignmentsPanelSkeleton />}>
        <ReviewAssignmentsPanelContent
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          phaseName={phaseName}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewAssignmentsPanelContent({
  processInstanceId,
  phaseId,
  phaseName,
}: {
  processInstanceId: string;
  phaseId: string;
  phaseName: string;
}) {
  const t = useTranslations();
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);

  const [data] = trpc.decision.listPhaseReviewAssignments.useSuspenseQuery({
    processInstanceId,
    phaseId,
  });

  const { rows, reviewerIdsByProposalId, unassignedCount } = useMemo(
    () => buildRows(data.reviewers, data.eligibleReviewers, data.proposals),
    [data.reviewers, data.eligibleReviewers, data.proposals],
  );

  const canAssign = data.eligibleReviewers.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {t(
            '{phase} · {reviewers} reviewers · {assignments} assignments · {unassigned} proposals unassigned',
            {
              phase: phaseName,
              reviewers: data.eligibleReviewers.length,
              assignments: data.totalAssignments,
              unassigned: unassignedCount,
            },
          )}
        </p>
        <Button
          disabled={!canAssign}
          onClick={() => setAssignTarget({ reviewerProfileId: null })}
        >
          <LuUserPlus data-icon="inline-start" />
          {t('Assign proposals')}
        </Button>
      </div>

      {data.totalAssignments === 0 ? (
        <Empty className="rounded-md border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuUsers className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{t('No review assignments yet')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'Pick a reviewer and assign them proposals. Each reviewer sees their assignments under "{queue}".',
                { queue: t('Proposals to review') },
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              disabled={!canAssign}
              onClick={() => setAssignTarget({ reviewerProfileId: null })}
            >
              <LuUserPlus data-icon="inline-start" />
              {t('Assign proposals')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <ReviewersTable
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            rows={rows}
            onAssignTo={(reviewerProfileId) =>
              setAssignTarget({ reviewerProfileId })
            }
          />
        </div>
      )}

      {assignTarget ? (
        <AssignProposalsDialog
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          eligibleReviewers={data.eligibleReviewers}
          proposals={data.proposals}
          reviewerIdsByProposalId={reviewerIdsByProposalId}
          initialReviewerProfileId={assignTarget.reviewerProfileId}
          onClose={() => setAssignTarget(null)}
        />
      ) : null}
    </div>
  );
}

function ReviewersTable({
  processInstanceId,
  phaseId,
  rows,
  onAssignTo,
}: {
  processInstanceId: string;
  phaseId: string;
  rows: ReviewerRow[];
  onAssignTo: (reviewerProfileId: string) => void;
}) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggle = (profileId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Reviewer')}</TableHead>
          <TableHead className="text-end">{t('Assigned')}</TableHead>
          <TableHead>{t('Progress')}</TableHead>
          <TableHead>{t('Last submission')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isExpanded = expanded.has(row.profile.id);
          const panelId = `review-assignments-${row.profile.id}`;

          return (
            <Fragment key={row.profile.id}>
              <ReviewerRowCells
                row={row}
                isExpanded={isExpanded}
                panelId={panelId}
                onToggle={() => toggle(row.profile.id)}
              />
              {isExpanded ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="bg-muted/50 p-0">
                    <div
                      id={panelId}
                      // ps tracks the toggle column (size-11 button + gap) so
                      // the nested table starts where the reviewer's name does.
                      className="flex flex-col gap-2.5 py-3 ps-14 pe-2"
                    >
                      <AssignmentsTable
                        processInstanceId={processInstanceId}
                        phaseId={phaseId}
                        assignments={row.assignments}
                        reviewerName={reviewerLabel(row.profile)}
                      />
                      {row.isEligible ? (
                        <Button
                          variant="outline"
                          className="self-start"
                          onClick={() => onAssignTo(row.profile.id)}
                        >
                          <LuUserPlus data-icon="inline-start" />
                          {t('Assign proposals to {name}', {
                            name: reviewerLabel(row.profile),
                          })}
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t(
                            'This reviewer no longer has the reviewer role, so they cannot take new proposals.',
                          )}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ReviewerRowCells({
  row,
  isExpanded,
  panelId,
  onToggle,
}: {
  row: ReviewerRow;
  isExpanded: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const name = reviewerLabel(row.profile);
  const lastSubmittedAt = row.lastSubmittedAt
    ? new Date(row.lastSubmittedAt)
    : null;
  const percent =
    row.assignedCount > 0 ? (row.submittedCount / row.assignedCount) * 100 : 0;

  return (
    <TableRow>
      {/* Names the row; `text-start` because a `th` centers by default. */}
      <TableCell render={<th scope="row" />} className="text-start font-normal">
        <span className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? panelId : undefined}
            aria-label={
              isExpanded
                ? t('Hide assignments for {name}', { name })
                : t('Show assignments for {name}', { name })
            }
            onClick={onToggle}
          >
            {isExpanded ? (
              <LuChevronDown className="text-muted-foreground" />
            ) : (
              <LuChevronRight className="text-muted-foreground rtl:-scale-x-100" />
            )}
          </Button>
          <ProfileItem
            avatar={<ProfileAvatar name={name} alt={name} />}
            title={name}
            description={row.email ?? undefined}
          />
        </span>
      </TableCell>
      <TableCell className="text-end">{row.assignedCount}</TableCell>
      <TableCell>
        {row.assignedCount === 0 ? (
          <span className="text-sm text-muted-foreground">
            {t('No assignments')}
          </span>
        ) : (
          <span className="flex items-center gap-2.5">
            <Progress
              value={percent}
              className="w-24"
              aria-label={t('Review progress')}
            />
            <span className="text-sm whitespace-nowrap text-muted-foreground">
              {t('{submitted} of {assigned} submitted', {
                submitted: row.submittedCount,
                assigned: row.assignedCount,
              })}
            </span>
          </span>
        )}
      </TableCell>
      <TableCell>
        {lastSubmittedAt
          ? format.dateTime(lastSubmittedAt, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : '—'}
      </TableCell>
    </TableRow>
  );
}

/**
 * The reviewer's proposals, in the `ReviewSelectionTable` idiom (its props
 * don't fit here, so this shares the vocabulary rather than the component).
 * Columbus reviewers carry 50–70 assignments, so the body scrolls in place.
 */
function AssignmentsTable({
  processInstanceId,
  phaseId,
  assignments,
  reviewerName,
}: {
  processInstanceId: string;
  phaseId: string;
  assignments: AdminReviewAssignment[];
  /** Names the nested table, so its header isn't read as the outer one's. */
  reviewerName: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const statusLabel = useStatusLabels();

  if (assignments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('No assignments in this phase yet.')}
      </p>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto">
      <Table
        aria-label={t('Proposals assigned to {name}', { name: reviewerName })}
      >
        <TableHeader>
          <TableRow>
            {/* Preferred widths, not caps: the slack lands in the Actions
                column so its end-aligned button reaches the far edge. */}
            <TableHead scope="col" className="w-56">
              {t('Proposal')}
            </TableHead>
            <TableHead scope="col" className="w-48">
              {t('Category')}
            </TableHead>
            <TableHead scope="col" className="w-32">
              {t('Status')}
            </TableHead>
            <TableHead scope="col" className="text-end">
              {t('Actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => {
            const state = assignment.reviewState ?? assignment.status;
            const authorName =
              assignment.author?.name ?? assignment.author?.slug ?? null;
            return (
              <TableRow key={assignment.id}>
                <TableCell
                  render={<th scope="row" />}
                  className="text-start font-normal"
                >
                  <span className="flex flex-col">
                    <span className="line-clamp-1 text-base text-foreground">
                      <bdi>
                        {assignment.proposalTitle ?? t('Untitled Proposal')}
                      </bdi>
                    </span>
                    {authorName ? (
                      <span className="line-clamp-1 text-sm text-muted-foreground">
                        <bdi>{authorName}</bdi>
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <SelectionCategoryChips
                    labels={assignment.categories.map(
                      (category) => category.label,
                    )}
                  />
                </TableCell>
                <TableCell>
                  <span className="flex flex-col items-start gap-1">
                    <Badge variant={statusBadgeVariant(assignment.reviewState)}>
                      {statusLabel[state] ?? state}
                    </Badge>
                    {/* On other rows the date would read as an assignment
                        timestamp. */}
                    {assignment.reviewState === 'submitted' &&
                    assignment.submittedAt ? (
                      <span className="text-sm whitespace-nowrap text-muted-foreground">
                        {format.dateTime(new Date(assignment.submittedAt), {
                          dateStyle: 'medium',
                        })}
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-end">
                  <AssignmentActionsMenu
                    processInstanceId={processInstanceId}
                    phaseId={phaseId}
                    assignment={assignment}
                    reviewerName={reviewerName}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Per-assignment overflow menu. Unassign is a hard delete, so a started row
 * keeps the item disabled rather than hidden — the admin can see why it isn't
 * offered. The confirm sits outside the menu because Base UI unmounts the menu
 * content on select, taking a nested dialog with it.
 */
function AssignmentActionsMenu({
  processInstanceId,
  phaseId,
  assignment,
  reviewerName,
}: {
  processInstanceId: string;
  phaseId: string;
  assignment: AdminReviewAssignment;
  reviewerName: string;
}) {
  const t = useTranslations();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const isRemovable = assignment.status === 'pending';

  // The list refetches through the `reviewAssignments` channel this publishes
  // to, so nothing invalidates by hand.
  const removeAssignments = trpc.decision.removeReviewAssignments.useMutation({
    onSuccess: ({ skippedIds }) => {
      // A skip means the row stopped being pending mid-dialog — started, or
      // already dropped by another admin. The API reports no reason.
      if (skippedIds.includes(assignment.id)) {
        toast.error(t('Could not unassign — the assignment has changed.'));
      } else {
        toast.success(
          t('Proposal unassigned from {name}', { name: reviewerName }),
        );
      }
      setIsConfirmOpen(false);
    },
    onError: (error) => {
      // Server text is untranslated and often internal.
      logger.error('Failed to unassign a review assignment', {
        error,
        context: 'AssignmentActionsMenu',
        assignmentId: assignment.id,
      });
      toast.error(t('Could not unassign the proposal. Please try again.'));
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('Assignment actions')}
            />
          }
        >
          <LuEllipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={!isRemovable}
              onClick={() => setIsConfirmOpen(true)}
            >
              {isRemovable ? t('Unassign') : t('Unassign (review started)')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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

function ReviewAssignmentsPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-11 w-44" />
      </div>
      <div className="flex flex-col gap-2 rounded-md border p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Rollups first (server-ordered), then eligible reviewers with nothing
 * assigned yet — no JS-side re-sort. Also inverts the rollups into
 * proposal → reviewers, which is all the assign dialog needs.
 */
function buildRows(
  reviewers: AdminDecisionReviewer[],
  eligibleReviewers: AdminEligibleReviewer[],
  proposals: AdminAssignableProposal[],
): {
  rows: ReviewerRow[];
  reviewerIdsByProposalId: ReadonlyMap<string, string[]>;
  unassignedCount: number;
} {
  const rollupByProfileId = new Map(
    reviewers.map((reviewer) => [reviewer.profile.id, reviewer]),
  );
  const emailByProfileId = new Map(
    eligibleReviewers.map((reviewer) => [reviewer.id, reviewer.email]),
  );

  const rows: ReviewerRow[] = [
    ...reviewers.map((reviewer) => ({
      ...reviewer,
      email: emailByProfileId.get(reviewer.profile.id) ?? null,
      isEligible: emailByProfileId.has(reviewer.profile.id),
    })),
    ...eligibleReviewers
      .filter((reviewer) => !rollupByProfileId.has(reviewer.id))
      .map((reviewer) => ({
        profile: { id: reviewer.id, name: reviewer.name, slug: reviewer.slug },
        email: reviewer.email,
        isEligible: true,
        assignedCount: 0,
        submittedCount: 0,
        draftCount: 0,
        lastSubmittedAt: null,
        assignments: [],
      })),
  ];

  const reviewerIdsByProposalId = new Map<string, string[]>();
  for (const reviewer of reviewers) {
    for (const assignment of reviewer.assignments) {
      const existing = reviewerIdsByProposalId.get(assignment.proposalId);
      if (existing) {
        existing.push(reviewer.profile.id);
      } else {
        reviewerIdsByProposalId.set(assignment.proposalId, [
          reviewer.profile.id,
        ]);
      }
    }
  }

  return {
    rows,
    reviewerIdsByProposalId,
    unassignedCount: proposals.filter(
      (proposal) => !reviewerIdsByProposalId.has(proposal.id),
    ).length,
  };
}

function reviewerLabel(profile: {
  id: string;
  name: string | null;
  slug: string | null;
}): string {
  return profile.name ?? profile.slug ?? profile.id;
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
