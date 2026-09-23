'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { useEffect, useState } from 'react';

/** How often to re-fetch while the document is still propagating from TipTap. */
const DOCUMENT_POLL_INTERVAL_MS = 2500;
/**
 * How long to keep polling for a missing document before treating it as
 * truly not found. Bounds the "still loading" window so a genuinely absent
 * document eventually surfaces an error instead of spinning forever.
 */
const DOCUMENT_POLL_TIMEOUT_MS = 20000;

export type ProposalDocumentState = 'ready' | 'pending' | 'error';

/**
 * A document that failed to fetch server-side comes back as
 * `{ type: 'unavailable' }` rather than absent, so this is the one shape that
 * means "not renderable yet".
 */
const hasUnavailableDocument = (proposal?: Proposal): boolean =>
  proposal?.documentContent?.type === 'unavailable';

const documentStateOf = (
  isUnavailable: boolean,
  timedOut: boolean,
): ProposalDocumentState => {
  if (!isUnavailable) {
    return 'ready';
  }

  return timedOut ? 'error' : 'pending';
};

/**
 * A proposal kept current while its collaboration document is still
 * propagating, plus the state its body should render in.
 *
 * A document that failed to fetch server-side comes back as
 * `{ type: 'unavailable' }`, which is usually transient — a proposal submitted
 * moments ago whose TipTap content hasn't landed yet. Left alone the preview
 * renders no body at all, so every surface that shows one has to poll and,
 * after a bounded wait, say the document is missing rather than spin forever.
 *
 * Shared by the proposal page and the side sheet so a just-submitted proposal
 * doesn't read as empty in one place and pending in the other. Keyed on the
 * same query as the caller's own read, so the two dedupe to one request.
 */
export function useLiveProposalDocument(initialProposal: Proposal): {
  proposal: Proposal;
  documentState: ProposalDocumentState;
} {
  const [timedOut, setTimedOut] = useState(false);

  const { data } = trpc.decision.getProposal.useQuery(
    { profileId: initialProposal.profileId },
    {
      // Stops once the document lands, and once the wait above has run out.
      refetchInterval: (query) =>
        hasUnavailableDocument(query.state.data) && !timedOut
          ? DOCUMENT_POLL_INTERVAL_MS
          : false,
    },
  );

  // Falls back to the proposal the caller already has, so the body renders
  // immediately rather than waiting on this query's first result.
  const proposal = data ?? initialProposal;
  const isUnavailable = hasUnavailableDocument(proposal);

  useEffect(() => {
    if (!isUnavailable) {
      setTimedOut(false);
      return;
    }

    const timer = setTimeout(() => setTimedOut(true), DOCUMENT_POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isUnavailable]);

  return { proposal, documentState: documentStateOf(isUnavailable, timedOut) };
}
