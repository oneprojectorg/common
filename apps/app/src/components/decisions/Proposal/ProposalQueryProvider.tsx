'use client';

import { trpc } from '@op/api/client';
import type { ReactNode } from 'react';

import { useLiveProposalDocument } from '../useLiveProposalDocument';
import { ProposalProvider } from './proposalContext';

/**
 * Reads one proposal and provides it to `ProposalBody` and its sections, with
 * the document kept live while it syncs. Suspends until the proposal loads.
 */
export function ProposalQueryProvider({
  profileId,
  decisionRoot,
  children,
}: {
  profileId: string;
  decisionRoot: string;
  children: ReactNode;
}) {
  const [initialProposal] = trpc.decision.getProposal.useSuspenseQuery({
    profileId,
  });
  const { proposal, documentState } = useLiveProposalDocument(initialProposal);

  return (
    <ProposalProvider
      proposal={proposal}
      decisionRoot={decisionRoot}
      documentState={documentState}
    >
      {children}
    </ProposalProvider>
  );
}
