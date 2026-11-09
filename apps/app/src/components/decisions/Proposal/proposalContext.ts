'use client';

import type { Proposal } from '@op/common/client';
import { createContext, useContext } from 'react';

import type { ProposalDocumentState } from '../useLiveProposalDocument';
import {
  type ProposalTranslationState,
  useTranslateProposal,
} from '../useTranslateProposal';

export interface ProposalContextValue {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
  /**
   * From `useLiveProposalDocument`, where the container re-fetches until the
   * collaboration document arrives. Absent reads as `ready`.
   */
  documentState?: ProposalDocumentState;
  translation: ProposalTranslationState;
}

/**
 * The proposal a surface shows. The container resolves it (a query, a page
 * prop, a review assignment) and holds its state; the proposal parts only
 * render it, so a layout change that remounts them loses nothing.
 */
export const ProposalContext = createContext<ProposalContextValue | null>(null);

export function useProposal(): ProposalContextValue {
  const value = useContext(ProposalContext);

  if (!value) {
    throw new Error('useProposal must be called inside a ProposalContext');
  }

  return value;
}

/**
 * The value a container provides. Call it in the component that stays mounted
 * for as long as the proposal is shown, so a shown translation survives.
 */
export function useProposalContextValue({
  proposal,
  decisionRoot,
  documentState,
}: Omit<ProposalContextValue, 'translation'>): ProposalContextValue {
  const translation = useTranslateProposal(proposal);

  return { proposal, decisionRoot, documentState, translation };
}
