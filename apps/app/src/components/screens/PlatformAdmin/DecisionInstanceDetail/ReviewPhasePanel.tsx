'use client';

import { trpc } from '@op/api/client';
import type {
  AdminDecisionReviewer,
  AdminReviewAssignment,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Progress } from '@op/sense/Progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { Fragment, useState } from 'react';
import { LuChevronDown, LuChevronRight, LuDownload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AssignReviewsDialog } from './AssignReviewsDialog';

/** Display labels for assignment statuses and review states. */
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  awaiting_author_revision: 'Awaiting revision',
  ready_for_re_review: 'Ready for re-review',
  completed: 'Completed',
  draft: 'Draft',
  submitted: 'Submitted',
};

const statusBadgeVariant = (state: string | null) => {
  if (state === 'submitted') {
    return 'default' as const;
  }
  if (state === 'draft') {
    return 'warning' as const;
  }
  return 'outline' as const;
};

/**
 * Builds a flat CSV of every assignment (one row per reviewer × proposal)
 * and triggers a browser download.
 */
const exportAssignmentsToCsv = (
  reviewers: AdminDecisionReviewer[],
  phaseId: string,
) => {
  const escape = (value: string | null) =>
    `"${(value ?? '').replace(/"/g, '""')}"`;

  const header =
    'reviewer,reviewer_slug,proposal,assignment_status,review_state,submitted_at\n';
  const rows = reviewers
    .flatMap((reviewer) =>
      reviewer.assignments.map((assignment) =>
        [
          escape(reviewer.profile.name),
          escape(reviewer.profile.slug),
          escape(assignment.proposalTitle ?? assignment.proposalId),
          escape(assignment.status),
          escape(assignment.reviewState),
          escape(assignment.submittedAt),
        ].join(','),
      ),
    )
    .join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `review-assignments-${phaseId}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Review assignment rollup for one phase, with manual assignment + CSV. */
export const ReviewPhasePanel = ({
  instanceId,
  phaseId,
  isCompleted = false,
}: {
  instanceId: string;
  phaseId: string;
  /** Completed phases are read-only: no manual assignment (server enforces too). */
  isCompleted?: boolean;
}) => {
  const t = useTranslations();
  const [data] =
    trpc.platform.admin.listDecisionReviewAssignments.useSuspenseQuery({
      instanceId,
      phaseId,
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {t('{reviewers} reviewers, {assignments} assignments', {
            reviewers: data.reviewers.length,
            assignments: data.totalAssignments,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAssignmentsToCsv(data.reviewers, phaseId)}
            disabled={data.totalAssignments === 0}
          >
            <LuDownload data-icon="inline-start" />
            {t('Download CSV')}
          </Button>
          {!isCompleted ? (
            <AssignReviewsDialog
              instanceId={instanceId}
              phaseId={phaseId}
              eligibleReviewers={data.eligibleReviewers}
              proposals={data.proposals}
            />
          ) : null}
        </div>
      </div>

      {data.reviewers.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {t('No review assignments in this phase yet.')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <ReviewersTable reviewers={data.reviewers} />
        </div>
      )}
    </div>
  );
};

const ReviewersTable = ({
  reviewers,
}: {
  reviewers: AdminDecisionReviewer[];
}) => {
  const t = useTranslations();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
          <TableHead>{t('Progress')}</TableHead>
          <TableHead className="text-end">{t('Drafts')}</TableHead>
          <TableHead>{t('Last submission')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviewers.map((reviewer) => (
          <Fragment key={reviewer.profile.id}>
            <ReviewerRow
              reviewer={reviewer}
              isExpanded={expanded.has(reviewer.profile.id)}
              onToggle={() => toggle(reviewer.profile.id)}
            />
            {expanded.has(reviewer.profile.id) ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="bg-muted/50 px-4 py-3">
                  <AssignmentsList assignments={reviewer.assignments} />
                </TableCell>
              </TableRow>
            ) : null}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
};

const ReviewerRow = ({
  reviewer,
  isExpanded,
  onToggle,
}: {
  reviewer: AdminDecisionReviewer;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const t = useTranslations();
  const format = useFormatter();
  const lastSubmittedAt = reviewer.lastSubmittedAt
    ? new Date(reviewer.lastSubmittedAt)
    : null;
  const percent =
    reviewer.assignedCount > 0
      ? (reviewer.submittedCount / reviewer.assignedCount) * 100
      : 0;

  return (
    <TableRow className="cursor-pointer" onClick={onToggle}>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {isExpanded ? (
            <LuChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <LuChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
          )}
          {reviewer.profile.name ?? reviewer.profile.slug}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2.5">
          <Progress
            value={percent}
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
      </TableCell>
      <TableCell className="text-end">{reviewer.draftCount}</TableCell>
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
};

const AssignmentsList = ({
  assignments,
}: {
  assignments: AdminReviewAssignment[];
}) => {
  const t = useTranslations();

  return (
    <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
      {assignments.map((assignment) => {
        const state = assignment.reviewState ?? assignment.status;
        return (
          <li
            key={assignment.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="truncate">
              {assignment.proposalTitle ?? t('Untitled proposal')}
            </span>
            <Badge variant={statusBadgeVariant(assignment.reviewState)}>
              {STATUS_LABEL[state] ?? state}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
};
