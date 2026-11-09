'use client';

import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { useEffect, useState } from 'react';

const DOCUMENT_POLL_INTERVAL_MS = 2500;
/** Past this, a missing document is reported rather than waited on. */
const DOCUMENT_POLL_TIMEOUT_MS = 20000;

export type ProposalDocumentState = 'ready' | 'pending' | 'error';

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
 * Re-fetches the proposal until its collaboration document arrives. A
 * just-submitted proposal's TipTap document can lag the proposal row by a few
 * seconds, and without this the viewer renders an empty body. `documentState`
 * tells `ProposalPreview` whether to show the body, a loading state, or the
 * "content not found" fallback once the wait times out.
 */
export function useLiveProposalDocument(initialProposal: Proposal): {
  proposal: Proposal;
  documentState: ProposalDocumentState;
} {
  const [timedOut, setTimedOut] = useState(false);

  const { data } = trpc.decision.getProposal.useQuery(
    { profileId: initialProposal.profileId },
    {
      refetchInterval: (query) =>
        hasUnavailableDocument(query.state.data) && !timedOut
          ? DOCUMENT_POLL_INTERVAL_MS
          : false,
    },
  );

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
