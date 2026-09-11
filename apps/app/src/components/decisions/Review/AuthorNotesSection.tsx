'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Suspense, useMemo, useState } from 'react';

import { type AuthorNote, AuthorNotesAccordion } from './AuthorNotesAccordion';
import { ViewRevisionRequestModal } from './ViewRevisionRequestModal';

// Context around the proposal, never a reason to fail the pane.
export function AuthorNotesSection({ proposalId }: { proposalId: string }) {
  return (
    <APIErrorBoundary fallbacks={{ default: () => null }}>
      <Suspense fallback={null}>
        <AuthorNotes proposalId={proposalId} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function AuthorNotes({ proposalId }: { proposalId: string }) {
  const [{ items }] = trpc.decision.listProposalRevisionNotes.useSuspenseQuery(
    { proposalId },
    // One fetch per mount registers the realtime channel.
    { refetchOnMount: 'always' },
  );

  const [viewedRequestIds, setViewedRequestIds] =
    useState<Array<string> | null>(null);

  const notes = useMemo<Array<AuthorNote>>(
    () =>
      items.flatMap((note) => {
        if (!note.responseComment || !note.respondedAt) {
          return [];
        }
        return [
          {
            id: note.respondedProposalHistoryId,
            comment: note.responseComment,
            respondedAt: note.respondedAt,
            requestIds: note.requests.map((request) => request.id),
          },
        ];
      }),
    [items],
  );

  const viewedRequests = useMemo(() => {
    if (!viewedRequestIds) {
      return [];
    }
    const ids = new Set(viewedRequestIds);
    return items
      .flatMap((note) => note.requests)
      .filter((request) => ids.has(request.id));
  }, [items, viewedRequestIds]);

  if (notes.length === 0) {
    return null;
  }

  return (
    <>
      <AuthorNotesAccordion
        notes={notes}
        onViewRequests={setViewedRequestIds}
      />
      <ViewRevisionRequestModal
        isOpen={viewedRequestIds !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewedRequestIds(null);
          }
        }}
        requests={viewedRequests}
      />
    </>
  );
}
