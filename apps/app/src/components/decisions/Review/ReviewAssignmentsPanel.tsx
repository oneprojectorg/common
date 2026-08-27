'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type {
  AdminAssignableProposal,
  AdminDecisionReviewer,
  AdminEligibleReviewer,
} from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Empty,
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
import { useFormatter } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';
import { LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AssignReviewsSheet, type ReviewerRow } from './AssignReviewsSheet';

export function ReviewAssignmentsPanel({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string;
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
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewAssignmentsPanelContent({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string;
}) {
  const t = useTranslations();
  const [openReviewerId, setOpenReviewerId] = useState<string | null>(null);

  const [data] = trpc.decision.listPhaseReviewAssignments.useSuspenseQuery({
    processInstanceId,
    phaseId,
  });

  const { rows, reviewerIdsByProposalId, unassignedCount } = useMemo(
    () => buildRows(data.reviewers, data.eligibleReviewers, data.proposals),
    [data.reviewers, data.eligibleReviewers, data.proposals],
  );

  const openReviewer = openReviewerId
    ? (rows.find((row) => row.profile.id === openReviewerId) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {t('{reviewers} reviewers · {unassigned} proposals unassigned', {
          reviewers: data.eligibleReviewers.length,
          unassigned: unassignedCount,
        })}
      </p>

      {rows.length === 0 ? (
        <Empty className="rounded-md border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LuUsers className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{t('No reviewers yet')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'Give people the reviewer role and they will appear here, ready to take proposals.',
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ReviewersTable rows={rows} onOpen={setOpenReviewerId} />
      )}

      {openReviewer ? (
        <AssignReviewsSheet
          key={openReviewer.profile.id}
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          reviewer={openReviewer}
          proposals={data.proposals}
          reviewerIdsByProposalId={reviewerIdsByProposalId}
          onClose={() => setOpenReviewerId(null)}
        />
      ) : null}
    </div>
  );
}

function ReviewersTable({
  rows,
  onOpen,
}: {
  rows: ReviewerRow[];
  onOpen: (reviewerProfileId: string) => void;
}) {
  const t = useTranslations();

  return (
    <Table aria-label={t('Reviewers')} className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead>{t('Reviewer')}</TableHead>
          <TableHead className="text-end">{t('Assigned')}</TableHead>
          <TableHead>{t('Progress')}</TableHead>
          <TableHead>{t('Last submission')}</TableHead>
          <TableHead className="text-end">
            <span className="sr-only">{t('Assign')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <ReviewerRowCells
            key={row.profile.id}
            row={row}
            onOpen={() => onOpen(row.profile.id)}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function ReviewerRowCells({
  row,
  onOpen,
}: {
  row: ReviewerRow;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const name = row.label;
  const lastSubmittedAt = row.lastSubmittedAt
    ? new Date(row.lastSubmittedAt)
    : null;
  const percent =
    row.assignedCount > 0 ? (row.submittedCount / row.assignedCount) * 100 : 0;

  return (
    <TableRow>
      {/* Names the row; `text-start` because a `th` centers by default. */}
      <TableCell render={<th scope="row" />} className="text-start font-normal">
        <Button
          variant="bare"
          onClick={onOpen}
          className="rounded-md p-1 hover:bg-muted"
          aria-label={t('Show assignments for {name}', { name })}
        >
          <ProfileItem
            avatar={<ProfileAvatar name={name} alt={name} />}
            title={name}
            description={row.email ?? undefined}
          />
        </Button>
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
      <TableCell className="text-end">
        <Button
          variant="outline"
          disabled={!row.isEligible}
          aria-label={t('Assign proposals to {name}', { name })}
          onClick={onOpen}
        >
          {t('Assign')}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ReviewAssignmentsPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-72" />
      <div className="flex flex-col gap-2">
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
 * proposal → reviewers, which is all the assign sheet needs.
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
      label: reviewerLabel(reviewer.profile),
      email: emailByProfileId.get(reviewer.profile.id) ?? null,
      isEligible: emailByProfileId.has(reviewer.profile.id),
    })),
    ...eligibleReviewers
      .filter((reviewer) => !rollupByProfileId.has(reviewer.id))
      .map((reviewer) => ({
        profile: { id: reviewer.id, name: reviewer.name, slug: reviewer.slug },
        label: reviewerLabel(reviewer),
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
