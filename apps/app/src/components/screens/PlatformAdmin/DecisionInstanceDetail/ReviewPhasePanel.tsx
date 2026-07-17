'use client';

import { trpc } from '@op/api/client';
import type {
  AdminDecisionReviewer,
  AdminReviewAssignment,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
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
}: {
  instanceId: string;
  phaseId: string;
}) => {
  const t = useTranslations();
  const [data] =
    trpc.platform.admin.listDecisionReviewAssignments.useSuspenseQuery({
      instanceId,
      phaseId,
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
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
          <AssignReviewsDialog
            instanceId={instanceId}
            phaseId={phaseId}
            eligibleReviewers={data.eligibleReviewers}
            proposals={data.proposals}
          />
        </div>
      </div>

      {data.reviewers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('No review assignments in this phase yet.')}
        </p>
      ) : (
        <ReviewersTable reviewers={data.reviewers} />
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
          <TableHead className="text-end">{t('Assigned')}</TableHead>
          <TableHead className="text-end">{t('Submitted')}</TableHead>
          <TableHead className="text-end">{t('Drafts')}</TableHead>
          <TableHead className="text-end">{t('Outstanding')}</TableHead>
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
              <TableRow>
                <TableCell colSpan={6} className="bg-muted/50 p-3">
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
  const format = useFormatter();
  const lastSubmittedAt = reviewer.lastSubmittedAt
    ? new Date(reviewer.lastSubmittedAt)
    : null;

  return (
    <TableRow className="cursor-pointer" onClick={onToggle}>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {isExpanded ? (
            <LuChevronDown className="size-3.5 shrink-0" />
          ) : (
            <LuChevronRight className="size-3.5 shrink-0 rtl:rotate-180" />
          )}
          {reviewer.profile.name ?? reviewer.profile.slug}
        </span>
      </TableCell>
      <TableCell className="text-end">{reviewer.assignedCount}</TableCell>
      <TableCell className="text-end">{reviewer.submittedCount}</TableCell>
      <TableCell className="text-end">{reviewer.draftCount}</TableCell>
      <TableCell className="text-end">
        {reviewer.assignedCount - reviewer.submittedCount}
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
};

const AssignmentsList = ({
  assignments,
}: {
  assignments: AdminReviewAssignment[];
}) => {
  const t = useTranslations();

  return (
    <ul className="flex flex-col gap-1.5">
      {assignments.map((assignment) => (
        <li
          key={assignment.id}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="truncate">
            {assignment.proposalTitle ?? t('Untitled proposal')}
          </span>
          <Badge
            variant={
              assignment.reviewState === 'submitted' ? 'default' : 'outline'
            }
          >
            {assignment.reviewState ?? assignment.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
};
