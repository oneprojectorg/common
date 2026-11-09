'use client';

import type { Proposal } from '@op/common/client';
import { createContext, useContext } from 'react';

export interface ProposalContextValue {
  proposal: Proposal;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}

/**
 * The proposal a surface shows. The container resolves it (a query, a page
 * prop, a review assignment) and the proposal parts only render it.
 */
export const ProposalContext = createContext<ProposalContextValue | null>(null);

export function useProposal(): ProposalContextValue {
  const value = useContext(ProposalContext);

  if (!value) {
    throw new Error('useProposal must be called inside a ProposalContext');
  }

  return value;
}
