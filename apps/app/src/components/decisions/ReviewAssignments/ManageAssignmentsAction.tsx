'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, useMemo } from 'react';

import { ManageAssignmentsDialog } from './ManageAssignmentsDialog';
import { buildReviewerRows } from './buildReviewerRows';

interface ManageAssignmentsActionProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
}

/** Owns the dialog: it needs the live list, and the owner of the data renders the button. */
export function ManageAssignmentsAction(props: ManageAssignmentsActionProps) {
  return (
    // A failed list already reports itself in the page body.
    <APIErrorBoundary fallbacks={{ default: () => null }}>
      <Suspense fallback={<Skeleton className="h-9 w-40" />}>
        <ManageAssignmentsTrigger {...props} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ManageAssignmentsTrigger({
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: ManageAssignmentsActionProps) {
  const [data] = trpc.decision.listPhaseReviewAssignments.useSuspenseQuery(
    { processInstanceId, phaseId },
    // Refetch through the client link on mount — the SSR-seeded cache alone
    // never registers the `reviewAssignments` realtime channel.
    { refetchOnMount: 'always' },
  );

  const { rows } = useMemo(
    () =>
      buildReviewerRows(data.reviewers, data.eligibleReviewers, data.proposals),
    [data.reviewers, data.eligibleReviewers, data.proposals],
  );

  const reviewer = rows.find((row) => row.profile.id === reviewerProfileId);

  if (!reviewer) {
    return null;
  }

  return (
    <ManageAssignmentsDialog
      processInstanceId={processInstanceId}
      phaseId={phaseId}
      reviewer={reviewer}
      proposals={data.proposals}
    />
  );
}
