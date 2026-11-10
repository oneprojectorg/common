'use client';

import type { Proposal } from '@op/common/client';
import { type ReactNode, createContext, useContext } from 'react';

import type { ProposalDocumentState } from '../useLiveProposalDocument';
import { useTranslateProposal } from '../useTranslateProposal';

export interface ProposalContextValue {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
  /**
   * From `useLiveProposalDocument`, where the container re-fetches until the
   * collaboration document arrives. Absent reads as `ready`.
   */
  documentState?: ProposalDocumentState;
  translation: ReturnType<typeof useTranslateProposal>;
}

const ProposalContext = createContext<ProposalContextValue | null>(null);

/**
 * The proposal a surface shows. The container resolves it (a query, a page
 * prop, a review assignment) and renders this above any layout switch, so a
 * shown translation survives when the parts below remount.
 */
export function ProposalProvider({
  proposal,
  decisionRoot,
  documentState,
  children,
}: Omit<ProposalContextValue, 'translation'> & { children: ReactNode }) {
  const translation = useTranslateProposal(proposal);

  return (
    <ProposalContext.Provider
      value={{ proposal, decisionRoot, documentState, translation }}
    >
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposal(): ProposalContextValue {
  const value = useContext(ProposalContext);

  if (!value) {
    throw new Error('useProposal must be used within a ProposalProvider');
  }

  return value;
}
