'use client';

import { trpc } from '@op/api/client';
import { createContext, useContext } from 'react';

export interface SheetProposal {
  profileId: string;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}

/** Set by `ProposalSheetShell` for the proposal it shows. */
export const SheetProposalContext = createContext<SheetProposal | null>(null);

/**
 * The proposal shown in the sheet. Every part shares the one `getProposal`
 * request, since React Query dedupes on the same input.
 */
export function useSheetProposal() {
  const sheetProposal = useContext(SheetProposalContext);

  if (!sheetProposal) {
    throw new Error(
      'useSheetProposal must be called inside ProposalSheetShell',
    );
  }

  const [proposal] = trpc.decision.getProposal.useSuspenseQuery({
    profileId: sheetProposal.profileId,
  });

  return { proposal, ...sheetProposal };
}
