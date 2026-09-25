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
 * A proposal re-fetched while its collaboration document is still propagating.
 * Without this a just-submitted proposal renders an empty body, since TipTap
 * content can lag the proposal row by a few seconds.
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
