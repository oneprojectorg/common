'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Suspense, useMemo, useState } from 'react';

import { type AuthorNote, AuthorNotesAccordion } from './AuthorNotesAccordion';
import { ViewRevisionRequestModal } from './ViewRevisionRequestModal';

/**
 * The author's revision notes on a proposal. The notes are context around the
 * proposal, never a reason to fail the pane: a slow read shows nothing until it
 * lands, a failed one shows nothing at all.
 */
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
    // 'always' forces one fetch per mount, which is what registers the
    // realtime channel via the tRPC client link.
    { refetchOnMount: 'always' },
  );

  const [viewedRequestIds, setViewedRequestIds] =
    useState<Array<string> | null>(null);

  const notes = useMemo<Array<AuthorNote>>(
    () =>
      items.flatMap((note) => {
        // A resubmission may carry no note; there is then nothing to show.
        if (!note.responseComment || !note.respondedAt) {
          return [];
        }
        return [
          {
            id: note.respondedProposalHistoryId ?? note.requests[0]?.id ?? '',
            comment: note.responseComment,
            respondedAt: note.respondedAt,
            requestIds: note.requests.map((request) => request.id),
          },
        ];
      }),
    [items],
  );

  // The list dialog takes every request the note answered, so the link opens
  // the whole set rather than only its first row.
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
