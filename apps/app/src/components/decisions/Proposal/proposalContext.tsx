'use client';

import type { Proposal } from '@op/common/client';
import { type ReactNode, createContext, useContext } from 'react';

import type { ProposalDocumentState } from '../useLiveProposalDocument';
import { useTranslateProposal } from '../useTranslateProposal';

export interface ProposalContextValue {
  proposal: Proposal;
  decisionRoot: string;
  /** See {@link useLiveProposalDocument}. */
  documentState?: ProposalDocumentState;
  translation: ReturnType<typeof useTranslateProposal>;
}

const ProposalContext = createContext<ProposalContextValue | null>(null);

/** Rendered above any layout switch, so a shown translation survives a remount. */
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
