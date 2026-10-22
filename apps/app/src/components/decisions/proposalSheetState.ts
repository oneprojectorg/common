'use client';

import { isPlainLeftClick } from '@/utils/isPlainLeftClick';
import { type MouseEvent, createContext, useCallback, useContext } from 'react';

/** Not `proposal` — `PromoteAccountModal` owns that key. */
export const PROPOSAL_SHEET_PARAM = 'proposalPanel';

export interface ProposalSheetControls {
  open: (profileId: string) => void;
}

/** Kept out of the provider file: the sheet renders cards that read this. */
export const ProposalSheetContext = createContext<ProposalSheetControls | null>(
  null,
);

/**
 * `onClick={openInSheet(profileId)}` — curried so a list can build one per card
 * inside its `map`. Returns `undefined` with no provider above, leaving the
 * link a plain link, which is the wanted fallback off a decision page.
 */
export function useOpenProposalInSheet() {
  const open = useContext(ProposalSheetContext)?.open;

  return useCallback(
    (profileId: string) =>
      open
        ? (event: MouseEvent<HTMLElement>) => {
            if (!isPlainLeftClick(event)) {
              return;
            }

            event.preventDefault();
            open(profileId);
          }
        : undefined,
    [open],
  );
}
